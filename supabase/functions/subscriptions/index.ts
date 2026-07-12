// Edge Function: subscriptions
// Money moves tiers, so tiers are set only here (service role). Clients can read
// their own subscription/claims via RLS, but never write one — approving your own
// payment must be impossible.
//
// Actions (JSON body):
//   create-claim   — start a manual (OMT / Whish / bank transfer) payment claim.
//                    The amount comes from the plan catalog and the expiry from
//                    settings — never from the client.
//   attach-receipt — attach an uploaded receipt (the client uploads to its own
//                    folder in the private payment-receipts bucket).
//   pending-claims — admin: the review queue, with signed receipt URLs.
//   review         — admin: approve (activates the tier) or reject a claim.
//   checkout       — card path. Returns `gateway_not_configured` until the Areeba
//                    credentials + `card_payments_enabled` are actually set, rather
//                    than pretending to take a payment.
//
// Deploy: `supabase functions deploy subscriptions`.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

const MANUAL_METHODS = new Set(['omt', 'whish', 'bank_transfer']);
const PAID_TIERS = new Set(['serious', 'marriage_plus']);

async function setting<T>(admin: SupabaseClient, key: string, fallback: T): Promise<T> {
  const { data } = await admin.from('settings').select('value').eq('key', key).maybeSingle();
  return (data?.value ?? fallback) as T;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization') ?? '';

  const asUser = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData } = await asUser.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(url, serviceKey);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? '');

  const isAdmin = async () => {
    const { data } = await admin.from('user_roles').select('role').eq('user_id', uid);
    return (data ?? []).some((r: { role: string }) => r.role === 'admin');
  };

  try {
    if (action === 'create-claim') {
      const tier = String(body.tier ?? '');
      const method = String(body.method ?? '');
      const period = body.period === 'yearly' ? 'yearly' : 'monthly';
      if (!PAID_TIERS.has(tier)) return json({ error: 'bad_tier' }, 400);
      if (!MANUAL_METHODS.has(method)) return json({ error: 'bad_method' }, 400);

      const { data: plan } = await admin
        .from('subscription_plans')
        .select('tier, name, monthly_price, yearly_price, currency, active')
        .eq('tier', tier)
        .maybeSingle();
      if (!plan || !plan.active) return json({ error: 'plan_unavailable' }, 400);

      const amount = period === 'yearly' ? plan.yearly_price : plan.monthly_price;
      if (amount == null) return json({ error: 'period_unavailable' }, 400);

      // One open claim at a time — a second one would just confuse the queue.
      const { data: open } = await admin
        .from('payment_claims')
        .select('id')
        .eq('user_id', uid)
        .eq('status', 'pending')
        .limit(1);
      if (open?.length) return json({ error: 'claim_already_open' }, 409);

      const days = Number(await setting(admin, 'payment_claim_expiry_days', 7)) || 7;
      const { data: claim, error } = await admin
        .from('payment_claims')
        .insert({
          user_id: uid,
          method,
          amount,
          currency: plan.currency,
          status: 'pending',
          expires_at: new Date(Date.now() + days * 864e5).toISOString(),
        })
        .select('id, reference_code, method, amount, currency, status, expires_at, submitted_at')
        .single();
      if (error) return json({ error: error.message }, 400);

      // The period the user paid for is recorded on the claim's audit trail; the
      // reviewer activates exactly that period.
      await admin.from('audit_logs').insert({
        actor_id: uid,
        action: 'payment_claim.created',
        entity_type: 'payment_claim',
        entity_id: claim.id,
        after: { tier, period, method, amount },
      });

      return json({ claim, tier, period });
    }

    if (action === 'attach-receipt') {
      const claimId = String(body.claimId ?? '');
      const path = String(body.path ?? '');
      // The storage policy already confines a user to their own folder; re-check
      // here so a forged path can never be written onto the claim row.
      if (!path.startsWith(`${uid}/`)) return json({ error: 'bad_path' }, 400);
      const { data: claim } = await admin
        .from('payment_claims')
        .select('id, user_id, status')
        .eq('id', claimId)
        .maybeSingle();
      if (!claim || claim.user_id !== uid) return json({ error: 'not_found' }, 404);
      if (claim.status !== 'pending') return json({ error: 'not_pending' }, 409);

      const { error } = await admin.from('payment_claims').update({ receipt_path: path }).eq('id', claimId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === 'pending-claims') {
      if (!(await isAdmin())) return json({ error: 'forbidden' }, 403);
      const { data: claims } = await admin
        .from('payment_claims')
        .select('id, user_id, method, reference_code, amount, currency, status, receipt_path, submitted_at, expires_at')
        .eq('status', 'pending')
        .order('submitted_at', { ascending: true });

      const ids = (claims ?? []).map((c: { user_id: string }) => c.user_id);
      const { data: profs } = await admin.from('profiles').select('id, display_name').in('id', ids);
      const nameById = new Map(
        ((profs ?? []) as { id: string; display_name: string | null }[]).map((p) => [p.id, p.display_name]),
      );

      const rows = await Promise.all(
        (claims ?? []).map(async (c: Record<string, unknown>) => {
          let receiptUrl: string | null = null;
          if (c.receipt_path) {
            const { data } = await admin.storage
              .from('payment-receipts')
              .createSignedUrl(String(c.receipt_path), 600);
            receiptUrl = data?.signedUrl ?? null;
          }
          // The requested tier/period live on the creation audit entry.
          const { data: log } = await admin
            .from('audit_logs')
            .select('after')
            .eq('entity_type', 'payment_claim')
            .eq('entity_id', String(c.id))
            .eq('action', 'payment_claim.created')
            .maybeSingle();
          const after = (log?.after ?? {}) as { tier?: string; period?: string };
          return {
            id: c.id,
            userId: c.user_id,
            displayName: nameById.get(String(c.user_id)) ?? null,
            method: c.method,
            referenceCode: c.reference_code,
            amount: c.amount,
            currency: c.currency,
            submittedAt: c.submitted_at,
            expiresAt: c.expires_at,
            receiptUrl,
            tier: after.tier ?? null,
            period: after.period ?? 'monthly',
          };
        }),
      );
      return json({ claims: rows });
    }

    if (action === 'review') {
      if (!(await isAdmin())) return json({ error: 'forbidden' }, 403);
      const claimId = String(body.claimId ?? '');
      const decision = String(body.decision ?? '');
      const reason = typeof body.reason === 'string' ? body.reason.slice(0, 300) : null;
      if (decision !== 'approved' && decision !== 'rejected') return json({ error: 'bad_decision' }, 400);

      const { data: claim } = await admin
        .from('payment_claims')
        .select('id, user_id, method, amount, currency, status')
        .eq('id', claimId)
        .maybeSingle();
      if (!claim) return json({ error: 'not_found' }, 404);
      if (claim.status !== 'pending') return json({ error: 'not_pending' }, 409);

      const now = new Date().toISOString();

      if (decision === 'rejected') {
        await admin
          .from('payment_claims')
          .update({ status: 'rejected', reviewed_at: now, reviewed_by: uid })
          .eq('id', claimId);
        await admin.from('audit_logs').insert({
          actor_id: uid,
          action: 'payment_claim.rejected',
          entity_type: 'payment_claim',
          entity_id: claimId,
          reason,
        });
        return json({ ok: true, status: 'rejected' });
      }

      // Approved → activate. Tier + period come from the creation audit entry, not
      // from the reviewer's request, so the user gets exactly what they claimed.
      const { data: log } = await admin
        .from('audit_logs')
        .select('after')
        .eq('entity_type', 'payment_claim')
        .eq('entity_id', claimId)
        .eq('action', 'payment_claim.created')
        .maybeSingle();
      const requested = (log?.after ?? {}) as { tier?: string; period?: string };
      const tier = requested.tier ?? 'serious';
      const period = requested.period === 'yearly' ? 'yearly' : 'monthly';
      if (!PAID_TIERS.has(tier)) return json({ error: 'bad_tier' }, 400);

      const days = Number(
        await setting(admin, period === 'yearly' ? 'subscription_period_days_yearly' : 'subscription_period_days_monthly', period === 'yearly' ? 365 : 30),
      );
      const expiresAt = new Date(Date.now() + days * 864e5).toISOString();

      // Close any current subscription, then open the new one.
      await admin.from('subscriptions').update({ status: 'expired' }).eq('user_id', claim.user_id).eq('status', 'active');
      const { data: sub, error: sErr } = await admin
        .from('subscriptions')
        .insert({ user_id: claim.user_id, tier, status: 'active', started_at: now, expires_at: expiresAt })
        .select('id, tier, expires_at')
        .single();
      if (sErr) return json({ error: sErr.message }, 400);

      await admin.from('payments').insert({
        user_id: claim.user_id,
        subscription_id: sub.id,
        method: claim.method,
        amount: claim.amount,
        currency: claim.currency,
        status: 'activated',
        gateway_ref: `manual:${claimId}`,
      });
      await admin
        .from('payment_claims')
        .update({ status: 'activated', reviewed_at: now, reviewed_by: uid })
        .eq('id', claimId);

      // The gates (photos, discovery, the Serious stage) read profiles.subscription_tier.
      await admin.from('profiles').update({ subscription_tier: tier }).eq('id', claim.user_id);

      await admin.from('audit_logs').insert({
        actor_id: uid,
        action: 'payment_claim.activated',
        entity_type: 'payment_claim',
        entity_id: claimId,
        after: { tier, period, expiresAt, subscriptionId: sub.id },
        reason,
      });

      return json({ ok: true, status: 'activated', tier, expiresAt });
    }

    if (action === 'checkout') {
      // Honest stub: no card flow exists until a gateway is configured. We never
      // want a checkout screen that looks real and silently does nothing.
      const enabled = await setting(admin, 'card_payments_enabled', false);
      const configured = Boolean(Deno.env.get('AREEBA_MERCHANT_ID') && Deno.env.get('AREEBA_API_KEY'));
      if (!enabled || !configured) return json({ error: 'gateway_not_configured' }, 501);
      return json({ error: 'gateway_not_implemented' }, 501);
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'unexpected_error' }, 500);
  }
});
