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
// Marriage Plus: shared budgets + shared goals (20260726100000_shared_budgets_goals.sql).
// Found while building monthly reports — `finance_shared_min_tier` (seeded 'marriage_plus'
// in Phase 12) was never read anywhere, so Marriage Plus added nothing over Serious in
// Finance. These actions are that gate, finally wired: on top of the shared MONTHLY
// TOTALS every Serious+ married couple gets, a couple where BOTH hold `finance_shared_min_tier`
// additionally gets a joint budget (target vs. the SUM of both spouses' spending in a
// category — never either person's entries) and a joint goal (one running balance either
// spouse can add to, like a shared jar, not a ledger of who contributed what).
//
// Actions (JSON body):
//   shared-status         — consent state for a match (either participant)
//   shared-consent        — record MY consent; activates only if every rule above holds
//   shared-disconnect     — either side, immediately, no counter-signature
//   shared-summary        — both sides' monthly totals, only while active
//   shared-budgets        — joint budgets + this month's combined spend (Marriage Plus, both)
//   shared-budget-save    — create/update a joint budget category (either spouse)
//   shared-budget-delete  — remove a joint budget category (either spouse)
//   shared-goals          — joint savings goals (Marriage Plus, both)
//   shared-goal-save      — create a joint goal (either spouse)
//   shared-goal-contribute — set a joint goal's new balance (either spouse)
//   shared-goal-delete    — remove a joint goal (either spouse)
//   report-narrative   — the AI paragraph for one of MY monthly reports (personal, no
//                        matchId). The report itself is generated server-side by the
//                        monthly_finance_reports cron job (see
//                        20260725120000_monthly_finance_reports.sql) with numbers only;
//                        this action adds the written insight on demand, the first time a
//                        member opens a report, and caches it back onto the row. No key,
//                        or the model fails ⇒ narrative stays null — the report was never
//                        waiting on it (same degrade pattern as suggest-questions).
//
// Deploy: `supabase functions deploy finance`.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk@0.68.0';
import { emit } from '../_shared/notify.ts';
import { secret } from '../_shared/env.ts';

const MODEL = Deno.env.get('MODERATION_MODEL') ?? 'claude-opus-4-8';
const FALLBACK_MODELS = ['claude-sonnet-5', 'claude-haiku-4-5'];

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

/** Latest USD-quoted rate per currency, same "newest as_of wins" rule as toRateMap() in
 *  src/utils/money.ts. */
async function rateMap(admin: SupabaseClient): Promise<Record<string, number>> {
  const { data } = await admin
    .from('exchange_rates')
    .select('quote_currency, rate')
    .eq('base_currency', 'USD')
    .order('as_of', { ascending: false });
  const map: Record<string, number> = { USD: 1 };
  for (const r of (data ?? []) as { quote_currency: string; rate: number }[]) {
    if (map[r.quote_currency] === undefined) map[r.quote_currency] = Number(r.rate);
  }
  return map;
}

function convert(amount: number, from: string, to: string, rates: Record<string, number>): number | null {
  if (from === to) return amount;
  const fromRate = rates[from];
  const toRate = rates[to];
  if (!fromRate || !toRate) return null;
  return (amount / fromRate) * toRate;
}

/**
 * Marriage Plus gate for shared budgets/goals: the connection must already be active
 * (both consented, both hold at least `basic_shared_finance_tier`) AND both spouses must
 * additionally hold `finance_shared_min_tier`. Checked on every call, never cached — a
 * disconnect or a downgrade between requests must take effect immediately.
 */
async function requireAdvanced(
  admin: SupabaseClient,
  match: { stage: string },
  row: { active: boolean } | null,
  uid: string,
  partnerId: string,
): Promise<Response | null> {
  if (!row?.active || match.stage !== 'married') return json({ error: 'not_active' }, 403);

  const minTier = await setting(admin, 'finance_shared_min_tier', 'marriage_plus');
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
  return null;
}

/**
 * The AI paragraph for one personal monthly report. Educational, never judging (Roadmap
 * Phase 12) — it notes what stands out, it does not scold, and it never gives investment
 * or religious rulings. Cached onto the report row so it is written once per report.
 */
async function reportNarrative(
  admin: SupabaseClient,
  uid: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const reportId = String(body.reportId ?? '');
  if (!reportId) return json({ error: 'report_required' }, 400);

  let report: { id: string; user_id: string; period: string; data: Record<string, unknown> } | null;
  try {
    const { data: row, error } = await admin
      .from('financial_reports')
      .select('id, user_id, period, data')
      .eq('id', reportId)
      .maybeSingle();
    if (error) throw error;
    report = row;
  } catch (e) {
    console.error('report_narrative_lookup_failed', e instanceof Error ? e.message : String(e));
    return json({ narrative: null });
  }
  if (!report || report.user_id !== uid) return json({ error: 'not_found' }, 404);

  const data = report.data ?? {};
  if (typeof data.narrative === 'string' && data.narrative.trim()) {
    return json({ narrative: data.narrative });
  }

  const anthropicKey = secret('ANTHROPIC_API_KEY');
  if (!anthropicKey) return json({ narrative: null }); // report stands on its own; no key, no paragraph

  const language =
    String(body.locale ?? 'en').startsWith('ar')
      ? 'Arabic (Modern Standard Arabic, warm and natural)'
      : 'English';

  const system = `You write a short, warm, non-judgmental paragraph about ONE member's own monthly finance report on Hayat, an Islamic marriage platform. You are given the numbers already computed server-side — do not recompute or contradict them.

Rules:
- Write in ${language}. 2-4 sentences, plain prose, no headings or bullet points.
- Note what actually stands out: a notable spending category, whether income covered expenses, budget adherence, and savings-goal progress — only the ones present in the data.
- Never scold or moralize. Encouraging and matter-of-fact, like a sensible friend, not a lecture.
- Never give investment advice, religious rulings (halal/haram specifics), or recommend specific products, banks, or brands.
- If unconvertible entries are non-zero, you may mention briefly that a few entries could not be converted — do not guess their value.
- Output ONLY the paragraph text. No JSON, no quotes, no preamble.`;

  const user = `Period: ${report.period}\n${JSON.stringify({ ...data, narrative: undefined })}`;

  const client = new Anthropic({ apiKey: anthropicKey, maxRetries: 1, timeout: 20_000 });
  for (const model of [MODEL, ...FALLBACK_MODELS]) {
    try {
      const response = await client.messages.create({
        model,
        max_tokens: 300,
        system,
        messages: [{ role: 'user', content: user }],
      });
      const block = response.content.find((b) => b.type === 'text');
      const text = block && block.type === 'text' ? block.text.trim() : '';
      if (!text) continue;

      await admin
        .from('financial_reports')
        .update({ data: { ...data, narrative: text }, updated_at: new Date().toISOString() })
        .eq('id', reportId);

      return json({ narrative: text });
    } catch (err) {
      console.error('report_narrative_failed', model, err instanceof Error ? err.message : String(err));
    }
  }

  // A missing paragraph is a degrade, not a failure — the numbers are already real.
  return json({ narrative: null });
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

  // Personal — no matchId, never crosses to another user. Handled before the
  // shared-finance matchId requirement below, which does not apply here.
  if (action === 'report-narrative') {
    return await reportNarrative(admin, uid, body);
  }

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
      const [minTier, advancedMinTier] = await Promise.all([
        setting(admin, 'basic_shared_finance_tier', 'serious'),
        setting(admin, 'finance_shared_min_tier', 'marriage_plus'),
      ]);
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
      const myTier = byId.get(uid)?.subscription_tier ?? 'free';
      const partnerTier = partner?.subscription_tier ?? 'free';

      return json(
        shape(row, {
          partnerName: partner?.display_name ?? null,
          // Both sides must hold the tier — this is a shared workspace, not a perk one
          // person can buy on the other's behalf.
          tiersOk: tierAtLeast(myTier, minTier) && tierAtLeast(partnerTier, minTier),
          minTier,
          // Marriage Plus, on top of the totals every Serious+ couple already gets.
          advancedUnlocked: tierAtLeast(myTier, advancedMinTier) && tierAtLeast(partnerTier, advancedMinTier),
          advancedMinTier,
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

      if (bothConsent) {
        await emit(admin, 'finance.shared_connected', uid, { matchId });
        await emit(admin, 'finance.shared_connected', partnerId, { matchId });
      }

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

    if (action === 'shared-budgets') {
      const gate = await requireAdvanced(admin, match, row, uid, partnerId);
      if (gate) return gate;

      const { data: budgets, error } = await admin
        .from('shared_budgets')
        .select('id, category, amount, currency')
        .eq('match_id', matchId)
        .order('category');
      if (error) return json({ error: error.message }, 400);

      const from = `${new Date().toISOString().slice(0, 7)}-01`;
      const [{ data: mine }, { data: theirs }, rates] = await Promise.all([
        admin.from('expenses').select('category, amount, currency').eq('user_id', uid).gte('occurred_on', from),
        admin
          .from('expenses')
          .select('category, amount, currency')
          .eq('user_id', partnerId)
          .gte('occurred_on', from),
        rateMap(admin),
      ]);

      const result = ((budgets ?? []) as { id: string; category: string; amount: number; currency: string }[]).map(
        (b) => {
          let spent = 0;
          let unconvertible = 0;
          for (const e of [...(mine ?? []), ...(theirs ?? [])] as {
            category: string;
            amount: number;
            currency: string;
          }[]) {
            if (e.category !== b.category) continue;
            const v = convert(Number(e.amount), e.currency, b.currency, rates);
            if (v == null) unconvertible += 1;
            else spent += v;
          }
          return {
            id: b.id,
            category: b.category,
            amount: Number(b.amount),
            currency: b.currency,
            spent: Math.round(spent * 100) / 100,
            unconvertible,
            overBudget: spent > Number(b.amount),
          };
        },
      );
      return json({ budgets: result });
    }

    if (action === 'shared-budget-save') {
      const gate = await requireAdvanced(admin, match, row, uid, partnerId);
      if (gate) return gate;

      const category = String(body.category ?? '').trim();
      const amount = Number(body.amount);
      const currency = String(body.currency ?? 'USD');
      if (!category || !Number.isFinite(amount) || amount <= 0) {
        return json({ error: 'invalid_input' }, 400);
      }

      const { error } = await admin
        .from('shared_budgets')
        .upsert({ match_id: matchId, category, amount, currency }, { onConflict: 'match_id,category' });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === 'shared-budget-delete') {
      const gate = await requireAdvanced(admin, match, row, uid, partnerId);
      if (gate) return gate;

      const id = String(body.id ?? '');
      if (!id) return json({ error: 'id_required' }, 400);
      const { error } = await admin.from('shared_budgets').delete().eq('id', id).eq('match_id', matchId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === 'shared-goals') {
      const gate = await requireAdvanced(admin, match, row, uid, partnerId);
      if (gate) return gate;

      const { data: goals, error } = await admin
        .from('shared_goals')
        .select('id, name, target_amount, current_amount, currency, deadline')
        .eq('match_id', matchId)
        .order('deadline', { ascending: true, nullsFirst: false });
      if (error) return json({ error: error.message }, 400);
      return json({
        goals: ((goals ?? []) as Record<string, unknown>[]).map((g) => ({
          ...g,
          target_amount: Number(g.target_amount),
          current_amount: Number(g.current_amount),
        })),
      });
    }

    if (action === 'shared-goal-save') {
      const gate = await requireAdvanced(admin, match, row, uid, partnerId);
      if (gate) return gate;

      const id = body.id ? String(body.id) : null;
      const name = String(body.name ?? '').trim();
      const target = Number(body.target);
      const currency = String(body.currency ?? 'USD');
      const deadline = body.deadline ? String(body.deadline) : null;
      if (!name || !Number.isFinite(target) || target <= 0) {
        return json({ error: 'invalid_input' }, 400);
      }

      // id present -> editing that goal's own fields (never its current_amount balance,
      // which only shared-goal-contribute touches); absent -> a new goal.
      const { error } = id
        ? await admin
            .from('shared_goals')
            .update({ name, target_amount: target, currency, deadline })
            .eq('id', id)
            .eq('match_id', matchId)
        : await admin
            .from('shared_goals')
            .insert({ match_id: matchId, name, target_amount: target, currency, deadline });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === 'shared-goal-contribute') {
      const gate = await requireAdvanced(admin, match, row, uid, partnerId);
      if (gate) return gate;

      const id = String(body.id ?? '');
      const newAmount = Number(body.newAmount);
      if (!id || !Number.isFinite(newAmount) || newAmount < 0) {
        return json({ error: 'invalid_input' }, 400);
      }
      const { error } = await admin
        .from('shared_goals')
        .update({ current_amount: newAmount })
        .eq('id', id)
        .eq('match_id', matchId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === 'shared-goal-delete') {
      const gate = await requireAdvanced(admin, match, row, uid, partnerId);
      if (gate) return gate;

      const id = String(body.id ?? '');
      if (!id) return json({ error: 'id_required' }, 400);
      const { error } = await admin.from('shared_goals').delete().eq('id', id).eq('match_id', matchId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'unexpected_error' }, 500);
  }
});
