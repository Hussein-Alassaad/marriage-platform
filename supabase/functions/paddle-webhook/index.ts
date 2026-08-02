// Edge Function: paddle-webhook
// Public, unauthenticated (Paddle calls it with no Supabase session — verified
// instead by PADDLE_WEBHOOK_SECRET, see _shared/paddle.ts). This is the ONLY
// place a Paddle payment turns into an actual subscription: it mirrors the
// exact activation steps subscriptions/index.ts's manual-claim `review`
// action already uses (close any current subscription, insert the new one,
// insert a payment row, update profiles.subscription_tier) so a card payment
// and an approved OMT/Whish claim behave identically from here on.
//
// Handles:
//   transaction.completed  — a payment succeeded (covers both the first
//                             payment AND every renewal charge on a
//                             subscription — Paddle fires this either way).
//   subscription.canceled  — access continues until the period already paid
//                             for ends; job_expire_subscriptions (existing
//                             pg_cron job) downgrades the tier at expires_at,
//                             same as it already does for manual claims.
//
// Deploy: `supabase functions deploy paddle-webhook --no-verify-jwt`
// (public — Paddle has no Supabase auth token to send).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyPaddleSignature } from '../_shared/paddle.ts';
import { emit } from '../_shared/notify.ts';

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

const PAID_TIERS = new Set(['serious', 'marriage_plus']);

interface PaddleTransaction {
  id: string;
  subscription_id?: string | null;
  custom_data?: { userId?: string; tier?: string; period?: string } | null;
  billing_period?: { ends_at?: string } | null;
  details?: { totals?: { total?: string; currency_code?: string } };
  currency_code?: string;
}

interface PaddleSubscription {
  id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const secret = Deno.env.get('PADDLE_WEBHOOK_SECRET');
  if (!secret) return json({ error: 'webhook_not_configured' }, 501);

  // Signature verification needs the RAW body — read it once as text, parse after.
  const rawBody = await req.text();
  const verified = await verifyPaddleSignature(rawBody, req.headers.get('Paddle-Signature'), secret);
  if (!verified) return json({ error: 'invalid_signature' }, 401);

  const event = JSON.parse(rawBody) as { event_type?: string; data?: unknown };
  const eventType = event.event_type;

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, serviceKey);

  try {
    if (eventType === 'transaction.completed') {
      const txn = event.data as PaddleTransaction;
      const userId = txn.custom_data?.userId;
      const tier = txn.custom_data?.tier;
      const period = txn.custom_data?.period === 'yearly' ? 'yearly' : 'monthly';
      if (!userId || !tier || !PAID_TIERS.has(tier)) {
        // Not one of ours (or malformed custom_data) — acknowledge so Paddle
        // doesn't retry forever, but do nothing.
        return json({ ok: true, skipped: 'no_matching_plan' });
      }

      // Idempotency: Paddle can and does redeliver webhooks. gateway_ref is
      // free-text (also used for OMT/Whish reference codes) so this is an
      // application-level check, not a DB constraint.
      const gatewayRef = `paddle:${txn.id}`;
      const { data: existing } = await admin
        .from('payments')
        .select('id')
        .eq('gateway_ref', gatewayRef)
        .maybeSingle();
      if (existing) return json({ ok: true, skipped: 'already_processed' });

      const now = new Date().toISOString();
      // Paddle knows the real billing period for this exact transaction — use
      // it directly rather than re-deriving days-from-now, which could drift
      // from what Paddle actually billed (proration, trial offsets, etc.).
      const expiresAt = txn.billing_period?.ends_at
        ?? new Date(Date.now() + (period === 'yearly' ? 365 : 30) * 864e5).toISOString();
      const amount = Number(txn.details?.totals?.total ?? 0) / 100; // Paddle amounts are in the smallest currency unit
      const currency = txn.details?.totals?.currency_code ?? txn.currency_code ?? 'USD';

      await admin.from('subscriptions').update({ status: 'expired' }).eq('user_id', userId).eq('status', 'active');
      const { data: sub, error: subErr } = await admin
        .from('subscriptions')
        .insert({
          user_id: userId,
          tier,
          status: 'active',
          started_at: now,
          expires_at: expiresAt,
          paddle_subscription_id: txn.subscription_id ?? null,
        })
        .select('id')
        .single();
      if (subErr) return json({ error: subErr.message }, 400);

      await admin.from('payments').insert({
        user_id: userId,
        subscription_id: sub.id,
        method: 'card',
        amount,
        currency,
        status: 'activated',
        gateway_ref: gatewayRef,
      });

      await admin.from('profiles').update({ subscription_tier: tier }).eq('id', userId);

      await admin.from('audit_logs').insert({
        actor_id: null,
        action: 'paddle.transaction_completed',
        entity_type: 'subscription',
        entity_id: sub.id,
        after: { tier, period, expiresAt, transactionId: txn.id, subscriptionId: txn.subscription_id ?? null },
      });

      await emit(admin, 'payment.approved', userId, { tier, expiresAt });

      return json({ ok: true });
    }

    if (eventType === 'subscription.canceled') {
      const paddleSub = event.data as PaddleSubscription;
      const { data: sub } = await admin
        .from('subscriptions')
        .select('id, user_id')
        .eq('paddle_subscription_id', paddleSub.id)
        .eq('status', 'active')
        .maybeSingle();
      // Nothing to do if we never had a matching active row (already expired,
      // or a subscription paddle-webhook doesn't recognize).
      if (!sub) return json({ ok: true, skipped: 'no_matching_subscription' });

      // Access continues until expires_at — the existing job_expire_subscriptions
      // pg_cron job downgrades profiles.subscription_tier when that passes,
      // same as it already does for a manual claim that isn't renewed.
      await admin.from('subscriptions').update({ auto_renew: false }).eq('id', sub.id);

      await admin.from('audit_logs').insert({
        actor_id: null,
        action: 'paddle.subscription_canceled',
        entity_type: 'subscription',
        entity_id: sub.id,
        after: { paddleSubscriptionId: paddleSub.id },
      });

      return json({ ok: true });
    }

    // Any other subscribed event (subscription.updated) is acknowledged but
    // not acted on yet — see CLAUDE.md for what this integration does and
    // does not handle.
    return json({ ok: true, skipped: 'unhandled_event_type' });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'unexpected_error' }, 500);
  }
});
