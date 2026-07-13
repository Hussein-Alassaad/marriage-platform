// Edge Function: finance (shared / couple finance)
//
// Personal finance never comes through here — those rows are owner-only under RLS and
// the client writes them directly. This function exists for the ONE part of the pillar
// that crosses two people, where a client write would be a privacy hole.
//
// The rules (Decisions #13 + #17, PRD Shared Finance):
//   • Both must be in the MARRIED stage. No exceptions, no "preview".
//   • Both must consent. One-sided consent activates nothing.
//   • Both must hold at least `basic_shared_finance_tier` (a setting, default: serious).
//   • Either side may disconnect at any time, alone, without asking the other.
//   • Terminating the match disconnects it too (handled in stage-transition).
//
// What is shared is deliberately narrow: MONTHLY TOTALS, never individual entries. A
// spouse sees "expenses were $1,240 this month", not the pharmacy receipt. Widening
// that would be a product decision, not an implementation detail.
//
// Actions (JSON body):
//   shared-status     — consent state for a match (either participant)
//   shared-consent    — record MY consent; activates only if every rule above holds
//   shared-disconnect — either side, immediately, no counter-signature
//   shared-summary    — both sides' monthly totals, only while active
//
// Deploy: `supabase functions deploy finance`.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

const TIER_ORDER = ['free', 'serious', 'marriage_plus'];
const tierAtLeast = (tier: string | null, min: string) => {
  const need = TIER_ORDER.indexOf(min);
  if (need < 0) return false; // unknown minimum: fail closed
  return TIER_ORDER.indexOf(tier ?? 'free') >= need;
};

async function setting<T>(admin: SupabaseClient, key: string, fallback: T): Promise<T> {
  const { data } = await admin.from('settings').select('value').eq('key', key).maybeSingle();
  return (data?.value ?? fallback) as T;
}

interface Totals {
  currency: string;
  income: number;
  expenses: number;
}

/** This month's totals for one member, grouped by the currency each amount was entered in. */
async function monthlyTotals(admin: SupabaseClient, userId: string): Promise<Totals[]> {
  const from = `${new Date().toISOString().slice(0, 7)}-01`;
  const [{ data: income }, { data: expenses }] = await Promise.all([
    admin.from('income').select('amount, currency').eq('user_id', userId).gte('occurred_on', from),
    admin.from('expenses').select('amount, currency').eq('user_id', userId).gte('occurred_on', from),
  ]);

  const byCurrency = new Map<string, Totals>();
  const bucket = (currency: string) => {
    const existing = byCurrency.get(currency) ?? { currency, income: 0, expenses: 0 };
    byCurrency.set(currency, existing);
    return existing;
  };
  for (const row of (income ?? []) as { amount: number; currency: string }[]) {
    bucket(row.currency).income += Number(row.amount);
  }
  for (const row of (expenses ?? []) as { amount: number; currency: string }[]) {
    bucket(row.currency).expenses += Number(row.amount);
  }
  return [...byCurrency.values()];
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
  const matchId = String(body.matchId ?? '');
  if (!matchId) return json({ error: 'match_required' }, 400);

  try {
    const { data: match } = await admin
      .from('matches')
      .select('id, user_a, user_b, stage, deleted_at')
      .eq('id', matchId)
      .maybeSingle();
    if (!match || match.deleted_at || (match.user_a !== uid && match.user_b !== uid)) {
      return json({ error: 'not_a_participant' }, 403);
    }

    const isA = match.user_a === uid;
    const partnerId = isA ? match.user_b : match.user_a;
    const myColumn = isA ? 'user_a_consent' : 'user_b_consent';
    const theirColumn = isA ? 'user_b_consent' : 'user_a_consent';

    const { data: row } = await admin
      .from('shared_finance')
      .select('id, user_a_consent, user_b_consent, active, activated_at, disconnected_at')
      .eq('match_id', matchId)
      .maybeSingle();

    const shape = (r: typeof row, extra: Record<string, unknown> = {}) => ({
      active: Boolean(r?.active),
      myConsent: Boolean(r?.[myColumn as 'user_a_consent']),
      partnerConsent: Boolean(r?.[theirColumn as 'user_a_consent']),
      married: match.stage === 'married',
      ...extra,
    });

    if (action === 'shared-status') {
      const minTier = await setting(admin, 'basic_shared_finance_tier', 'serious');
      const { data: profs } = await admin
        .from('profiles')
        .select('id, display_name, subscription_tier')
        .in('id', [uid, partnerId]);
      const byId = new Map(
        ((profs ?? []) as { id: string; display_name: string | null; subscription_tier: string }[]).map((p) => [
          p.id,
          p,
        ]),
      );
      const partner = byId.get(partnerId);

      return json(
        shape(row, {
          partnerName: partner?.display_name ?? null,
          // Both sides must hold the tier — this is a shared workspace, not a perk one
          // person can buy on the other's behalf.
          tiersOk:
            tierAtLeast(byId.get(uid)?.subscription_tier ?? 'free', minTier) &&
            tierAtLeast(partner?.subscription_tier ?? 'free', minTier),
          minTier,
        }),
      );
    }

    if (action === 'shared-consent') {
      if (match.stage !== 'married') return json({ error: 'married_stage_required' }, 403);

      const minTier = await setting(admin, 'basic_shared_finance_tier', 'serious');
      const { data: profs } = await admin
        .from('profiles')
        .select('id, subscription_tier')
        .in('id', [uid, partnerId]);
      const tiers = new Map(
        ((profs ?? []) as { id: string; subscription_tier: string }[]).map((p) => [p.id, p.subscription_tier]),
      );
      if (!tierAtLeast(tiers.get(uid) ?? 'free', minTier) || !tierAtLeast(tiers.get(partnerId) ?? 'free', minTier)) {
        return json({ error: 'tier_required', minTier }, 403);
      }

      const partnerConsent = Boolean(row?.[theirColumn as 'user_a_consent']);
      const bothConsent = partnerConsent; // mine is about to become true
      const now = new Date().toISOString();

      const { data: saved, error } = await admin
        .from('shared_finance')
        .upsert(
          {
            match_id: matchId,
            [myColumn]: true,
            [theirColumn]: partnerConsent,
            active: bothConsent,
            activated_at: bothConsent ? (row?.activated_at ?? now) : null,
            disconnected_at: null,
          },
          { onConflict: 'match_id' },
        )
        .select('id, user_a_consent, user_b_consent, active, activated_at, disconnected_at')
        .single();
      if (error) return json({ error: error.message }, 400);

      await admin.from('audit_logs').insert({
        actor_id: uid,
        action: bothConsent ? 'shared_finance.activated' : 'shared_finance.consented',
        entity_type: 'shared_finance',
        entity_id: saved.id,
        after: { match_id: matchId, active: saved.active },
      });

      return json(shape(saved));
    }

    if (action === 'shared-disconnect') {
      // Either side, alone. Consent is not required to LEAVE — only to join.
      if (!row) return json({ error: 'not_active' }, 404);
      const { data: saved, error } = await admin
        .from('shared_finance')
        .update({
          active: false,
          user_a_consent: false,
          user_b_consent: false,
          disconnected_at: new Date().toISOString(),
        })
        .eq('match_id', matchId)
        .select('id, user_a_consent, user_b_consent, active, activated_at, disconnected_at')
        .single();
      if (error) return json({ error: error.message }, 400);

      await admin.from('audit_logs').insert({
        actor_id: uid,
        action: 'shared_finance.disconnected',
        entity_type: 'shared_finance',
        entity_id: saved.id,
        after: { match_id: matchId },
      });

      return json(shape(saved));
    }

    if (action === 'shared-summary') {
      // The gate is re-checked here, not trusted from the status call: a disconnect or a
      // termination between the two requests must take effect immediately.
      if (!row?.active || match.stage !== 'married') return json({ error: 'not_active' }, 403);

      const [mine, theirs] = await Promise.all([monthlyTotals(admin, uid), monthlyTotals(admin, partnerId)]);
      const { data: partner } = await admin
        .from('profiles')
        .select('display_name')
        .eq('id', partnerId)
        .maybeSingle();

      // Totals only — never the entries themselves.
      return json({ mine, theirs, partnerName: partner?.display_name ?? null });
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'unexpected_error' }, 500);
  }
});
