// Edge Function: admin
//
// One audited surface for every administrative action. Three rules run through all of it:
//
//   1. Every mutation is written to `audit_logs` with who, what, and the before/after.
//      An admin action that leaves no trace is indistinguishable from an attack.
//   2. An admin can operate the platform without ever reading a private conversation.
//      There is no action here that returns message bodies. Moderation review works from
//      the moderation log (verdicts, categories), not from people's chats.
//   3. Reading an identity document is itself an event worth recording — `verification-queue`
//      audits the fact that documents were viewed, because Decision #15 promises members
//      that only authorised admins ever see them, and a promise nobody can check is not one.
//
// Actions: overview | health | settings-list | settings-update | users-search |
//          user-status | verification-queue | verification-review | coupons |
//          coupon-create | coupon-toggle | analytics | jobs | job-run | job-toggle |
//          audit | tickets | ticket-update | flagged-violations | violation-review
//
// flagged-violations / violation-review close the "repeated or severe violations →
// administrator review" step of the escalation ladder (Decisions Part D) —
// `record_violation` (20260726150000_violation_escalation_ladder.sql) sets
// `requires_review` on a violation row; this is where an admin actually sees and
// clears it, same list→review shape as verification-queue/verification-review.
//
// Deploy: `supabase functions deploy admin`.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { emit } from '../_shared/notify.ts';
import { runHealthChecks } from '../_shared/health.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

const STATUSES = new Set(['active', 'suspended', 'banned']);

/** Settings an admin may NOT edit from the dashboard, however tempting. */
const PROTECTED_SETTINGS = new Set<string>([
  // Nothing yet — but the list exists so that "can an admin switch off moderation?" has a
  // deliberate answer rather than an accidental one. `moderation_ai_enabled` stays
  // editable on purpose: running key-free is a real, supported mode.
]);

async function audit(
  admin: SupabaseClient,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  before: unknown,
  after: unknown,
  reason?: string,
) {
  await admin.from('audit_logs').insert({
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    before: before ?? null,
    after: after ?? null,
    reason: reason ?? null,
  });
}

/** Row count without pulling the rows (head: true). */
async function countRows(admin: SupabaseClient, table: string, column = 'id'): Promise<number> {
  const { count } = await admin.from(table).select(column, { count: 'exact', head: true });
  return count ?? 0;
}

async function countWhere(
  admin: SupabaseClient,
  table: string,
  column: string,
  value: string,
): Promise<number> {
  const { count } = await admin.from(table).select('id', { count: 'exact', head: true }).eq(column, value);
  return count ?? 0;
}

// ── Analytics helpers ────────────────────────────────────────────────────────
function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age;
}

function ageGroup(age: number | null): string {
  if (age == null) return 'unknown';
  if (age < 25) return '18-24';
  if (age < 31) return '25-30';
  if (age < 41) return '31-40';
  return '41+';
}

function tally(values: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of values) out[v] = (out[v] ?? 0) + 1;
  return out;
}

/** Top N by count; everything else folds into "other" so a rare (potentially
 *  identifying) value never appears on its own as a named bucket. */
function topWithOther(counts: Record<string, number>, n: number): Record<string, number> {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top = entries.slice(0, n);
  const rest = entries.slice(n).reduce((sum, [, c]) => sum + c, 0);
  const out: Record<string, number> = Object.fromEntries(top);
  if (rest > 0) out.other = (out.other ?? 0) + rest;
  return out;
}

/**
 * Match Analytics (PRD): "Average Time Until Conversation/Family Stage/Marriage" —
 * computed straight from `stage_history`, which already timestamps every stage
 * change (Phase 8). For each match, the first row is its start; the average delta
 * to each later stage's first occurrence, across every match that reached it, in
 * days. A stage nobody has reached yet returns null rather than 0 — no data is not
 * the same as "instant".
 */
function computeMatchTiming(
  history: { match_id: string; to_stage: string; created_at: string }[],
): Record<string, number | null> {
  const byMatch = new Map<string, { start: number; reached: Map<string, number> }>();
  for (const row of history) {
    const t = new Date(row.created_at).getTime();
    let m = byMatch.get(row.match_id);
    if (!m) {
      m = { start: t, reached: new Map() };
      byMatch.set(row.match_id, m);
    }
    if (!m.reached.has(row.to_stage)) m.reached.set(row.to_stage, t);
  }

  const stages = ['introduction', 'serious_communication', 'family', 'married'];
  const result: Record<string, number | null> = {};
  for (const stage of stages) {
    const deltasDays: number[] = [];
    for (const m of byMatch.values()) {
      const reachedAt = m.reached.get(stage);
      if (reachedAt != null) deltasDays.push((reachedAt - m.start) / 86_400_000);
    }
    result[stage] = deltasDays.length
      ? Math.round((deltasDays.reduce((a, b) => a + b, 0) / deltasDays.length) * 10) / 10
      : null;
  }
  return result;
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

  // Role is read server-side. A frontend role check is a UX affordance, never a gate.
  const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', uid);
  const roleNames = (roles ?? []).map((r: { role: string }) => r.role);
  if (!roleNames.some((r) => r === 'admin' || r === 'super_admin')) {
    return json({ error: 'forbidden' }, 403);
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? '');

  try {
    if (action === 'overview') {
      const [members, verified, pendingVerifications, pendingClaims, activeMatches, openTickets] = await Promise.all([
        countRows(admin, 'profiles'),
        countWhere(admin, 'profiles', 'verification_status', 'verified'),
        countWhere(admin, 'identity_verifications', 'status', 'pending'),
        countWhere(admin, 'payment_claims', 'status', 'pending'),
        admin
          .from('matches')
          .select('id', { count: 'exact', head: true })
          .is('deleted_at', null)
          .then((r) => r.count ?? 0),
        countWhere(admin, 'support_tickets', 'status', 'open'),
      ]);

      // Tier split, and the moderation picture — the two things that tell you whether the
      // platform is healthy. Neither requires reading anyone's messages.
      const { data: tiers } = await admin.from('profiles').select('subscription_tier');
      const tierCounts: Record<string, number> = { free: 0, serious: 0, marriage_plus: 0 };
      for (const row of (tiers ?? []) as { subscription_tier: string }[]) {
        tierCounts[row.subscription_tier] = (tierCounts[row.subscription_tier] ?? 0) + 1;
      }

      const since = new Date(Date.now() - 7 * 864e5).toISOString();
      const { data: mods } = await admin
        .from('message_moderation')
        .select('verdict, category')
        .gte('created_at', since);
      const blocked = (mods ?? []).filter((m: { verdict: string }) => m.verdict !== 'allowed');
      const byCategory: Record<string, number> = {};
      for (const m of blocked as { category: string | null }[]) {
        const key = m.category ?? 'unknown';
        byCategory[key] = (byCategory[key] ?? 0) + 1;
      }

      return json({
        members,
        verified,
        pendingVerifications,
        pendingClaims,
        activeMatches,
        openTickets,
        tiers: tierCounts,
        moderation: { checked: (mods ?? []).length, blocked: blocked.length, byCategory },
      });
    }

    if (action === 'health') {
      // Shared with the public `health-check` function (_shared/health.ts) so an
      // admin looking at the dashboard and an external uptime monitor can never
      // see a different answer to "is this platform healthy".
      return json(await runHealthChecks(admin));
    }

    if (action === 'settings-list') {
      const { data } = await admin
        .from('settings')
        .select('key, value, type, is_public, description, updated_at')
        .order('key');
      return json({ settings: data ?? [] });
    }

    if (action === 'settings-update') {
      const key = String(body.key ?? '');
      if (!key) return json({ error: 'key_required' }, 400);
      if (PROTECTED_SETTINGS.has(key)) return json({ error: 'setting_protected' }, 403);
      if (body.value === undefined) return json({ error: 'value_required' }, 400);

      const { data: current } = await admin.from('settings').select('value, type').eq('key', key).maybeSingle();
      if (!current) return json({ error: 'unknown_setting' }, 404);

      // The value arrives already typed from the client, but a string where a number
      // belongs would poison every reader of this setting — so check it here.
      const value = body.value;
      const actual = typeof value;
      const expected = current.type as string;
      const ok =
        (expected === 'number' && actual === 'number') ||
        (expected === 'boolean' && actual === 'boolean') ||
        (expected === 'string' && actual === 'string') ||
        (expected === 'json' && (Array.isArray(value) || actual === 'object'));
      if (!ok) return json({ error: 'type_mismatch', expected }, 400);

      const { error } = await admin.from('settings').update({ value, updated_by: uid }).eq('key', key);
      if (error) return json({ error: error.message }, 400);

      // settings_history records this too (Phase 2 trigger); the audit log is the
      // cross-domain view — "what did this admin do today", across every table.
      await audit(admin, uid, 'settings.updated', 'setting', key, current.value, value);
      return json({ ok: true });
    }

    if (action === 'users-search') {
      const q = String(body.query ?? '').trim();
      let query = admin
        .from('profiles')
        .select('id, display_name, gender, country, verification_status, subscription_tier, status, suspended_until, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (q) query = query.ilike('display_name', `%${q}%`);
      const { data } = await query;
      return json({ users: data ?? [] });
    }

    if (action === 'user-status') {
      const userId = String(body.userId ?? '');
      const status = String(body.status ?? '');
      const reason = body.reason ? String(body.reason).slice(0, 300) : null;
      if (!userId || !STATUSES.has(status)) return json({ error: 'bad_request' }, 400);
      if (userId === uid) return json({ error: 'cannot_suspend_yourself' }, 400);

      // An admin must not be able to suspend another admin from the dashboard: that is how
      // one compromised account locks everyone else out.
      const { data: targetRoles } = await admin.from('user_roles').select('role').eq('user_id', userId);
      if ((targetRoles ?? []).some((r: { role: string }) => r.role === 'admin' || r.role === 'super_admin')) {
        return json({ error: 'cannot_suspend_admin' }, 403);
      }

      const { data: before } = await admin
        .from('profiles')
        .select('status, suspended_until, suspension_reason')
        .eq('id', userId)
        .maybeSingle();

      const days = Number(body.days ?? 0);
      const until = status === 'suspended' && days > 0 ? new Date(Date.now() + days * 864e5).toISOString() : null;

      const { error } = await admin
        .from('profiles')
        .update({ status, suspended_until: until, suspension_reason: status === 'active' ? null : reason })
        .eq('id', userId);
      if (error) return json({ error: error.message }, 400);

      await audit(admin, uid, `user.${status}`, 'profile', userId, before, { status, suspended_until: until }, reason ?? undefined);
      return json({ ok: true });
    }

    if (action === 'flagged-violations') {
      const { data: rows } = await admin
        .from('violations')
        .select('id, user_id, category, severity, created_at')
        .eq('requires_review', true)
        .is('reviewed_at', null)
        .order('created_at', { ascending: false })
        .limit(100);
      const userIds = [...new Set((rows ?? []).map((r: { user_id: string }) => r.user_id))];
      const { data: profs } = userIds.length
        ? await admin.from('profiles').select('id, display_name, status').in('id', userIds)
        : { data: [] };
      const byId = new Map(((profs ?? []) as { id: string; display_name: string | null; status: string }[]).map((p) => [p.id, p]));

      // One row per user (their most severe/most recent flagged violation), plus
      // their total lifetime violation count — an admin reviewing needs the whole
      // picture, not just the one row that happened to trip the flag.
      const seen = new Set<string>();
      const flagged = [];
      for (const r of (rows ?? []) as { id: string; user_id: string; category: string; severity: number; created_at: string }[]) {
        if (seen.has(r.user_id)) continue;
        seen.add(r.user_id);
        const { count } = await admin
          .from('violations')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', r.user_id);
        flagged.push({
          violationId: r.id,
          userId: r.user_id,
          displayName: byId.get(r.user_id)?.display_name ?? null,
          status: byId.get(r.user_id)?.status ?? 'active',
          category: r.category,
          severity: r.severity,
          totalViolations: count ?? 0,
          createdAt: r.created_at,
        });
      }
      return json({ flagged });
    }

    if (action === 'violation-review') {
      const violationId = String(body.violationId ?? '');
      if (!violationId) return json({ error: 'bad_request' }, 400);
      const { error } = await admin
        .from('violations')
        .update({ reviewed_at: new Date().toISOString(), reviewed_by: uid })
        .eq('id', violationId);
      if (error) return json({ error: error.message }, 400);
      await audit(admin, uid, 'violation.reviewed', 'violation', violationId, null, { reviewed_by: uid });
      return json({ ok: true });
    }

    if (action === 'verification-queue') {
      const { data: pending } = await admin
        .from('identity_verifications')
        .select('id, user_id, status, document_type, document_path, selfie_path, submitted_at')
        .eq('status', 'pending')
        .order('submitted_at');

      const rows = (pending ?? []) as {
        id: string;
        user_id: string;
        document_type: string | null;
        document_path: string | null;
        selfie_path: string | null;
        submitted_at: string;
      }[];
      if (!rows.length) return json({ queue: [] });

      const { data: profs } = await admin
        .from('profiles')
        .select('id, display_name, dob, gender, country')
        .in('id', rows.map((r) => r.user_id));
      const byId = new Map(((profs ?? []) as Record<string, unknown>[]).map((p) => [String(p.id), p]));

      // Short-lived signed URLs — the bucket has no client policies at all, so this is the
      // only way a document is ever seen, and it expires.
      const queue = await Promise.all(
        rows.map(async (r) => {
          const sign = async (path: string | null) => {
            if (!path) return null;
            const { data } = await admin.storage.from('identity-documents').createSignedUrl(path, 600);
            return data?.signedUrl ?? null;
          };
          return {
            id: r.id,
            userId: r.user_id,
            documentType: r.document_type,
            submittedAt: r.submitted_at,
            profile: byId.get(r.user_id) ?? null,
            documentUrl: await sign(r.document_path),
            selfieUrl: await sign(r.selfie_path),
          };
        }),
      );

      // Decision #15 promises only authorised admins see these. A promise nobody can
      // check is not a promise — so looking is itself logged.
      await audit(admin, uid, 'verification.documents_viewed', 'identity_verification', null, null, {
        count: queue.length,
      });

      return json({ queue });
    }

    if (action === 'verification-review') {
      const id = String(body.id ?? '');
      const decision = String(body.decision ?? '');
      const reason = body.reason ? String(body.reason).slice(0, 300) : null;
      if (!id || (decision !== 'verified' && decision !== 'rejected')) return json({ error: 'bad_request' }, 400);

      const { data: record } = await admin
        .from('identity_verifications')
        .select('id, user_id, status')
        .eq('id', id)
        .maybeSingle();
      if (!record || record.status !== 'pending') return json({ error: 'not_actionable' }, 400);

      await admin
        .from('identity_verifications')
        .update({
          status: decision,
          reviewed_by: uid,
          reviewed_at: new Date().toISOString(),
          rejection_reason: decision === 'rejected' ? reason : null,
        })
        .eq('id', id);

      // The profile flag is the gate the whole platform reads. Verifying also locks
      // gender (Decision #8) — the trigger on profiles enforces that from here on.
      await admin.from('profiles').update({ verification_status: decision }).eq('id', record.user_id);
      if (decision === 'verified') {
        await admin
          .from('verification_badges')
          .upsert({ user_id: record.user_id, badge: 'identity' }, { onConflict: 'user_id,badge' });
      }

      await audit(admin, uid, `verification.${decision}`, 'identity_verification', id, { status: 'pending' }, { status: decision }, reason ?? undefined);
      await emit(
        admin,
        decision === 'verified' ? 'verification.approved' : 'verification.rejected',
        record.user_id,
        decision === 'rejected' ? { reason } : {},
      );

      return json({ ok: true });
    }

    if (action === 'analytics') {
      // AGGREGATES ONLY. Note what is absent and cannot be added here without someone
      // noticing: no message bodies, and no personal finance. Admins get shapes and
      // counts — "how many people are stuck at Introduction" — never a person's spending
      // or a person's words. That is a structural promise, not a policy one.
      const days = Math.min(Math.max(Number(body.days ?? 30), 7), 365);
      const since = new Date(Date.now() - days * 864e5).toISOString();

      const [
        { data: profiles },
        { data: matches },
        { data: payments },
        { data: mods },
        { data: ai },
        { data: tickets },
        { data: violations },
      ] = await Promise.all([
        admin.from('profiles').select('created_at, verification_status, subscription_tier, gender, dob, country, city, status'),
        admin.from('matches').select('stage, created_at, deleted_at'),
        admin.from('payments').select('amount, currency, status, created_at').gte('created_at', since),
        admin.from('message_moderation').select('verdict, category, created_at').gte('created_at', since),
        admin.from('ai_requests').select('feature, status, total_tokens, created_at').gte('created_at', since),
        admin.from('support_tickets').select('category, status, created_at'),
        admin.from('violations').select('category, severity, requires_review, reviewed_at, created_at').gte('created_at', since),
      ]);

      const { data: filterEvents } = await admin
        .from('filter_usage_events')
        .select('filter_key')
        .gte('created_at', since);
      const topFilters = tally(((filterEvents ?? []) as { filter_key: string }[]).map((f) => f.filter_key));

      // Match Analytics: average days from a match's start (interest_sent) to each
      // later stage it reached. All-time, not windowed by `since` — a recent-only
      // window would bias toward matches that haven't had time to progress yet.
      const { data: history } = await admin
        .from('stage_history')
        .select('match_id, to_stage, created_at')
        .order('match_id')
        .order('created_at');
      const matchTiming = computeMatchTiming((history ?? []) as { match_id: string; to_stage: string; created_at: string }[]);

      // Signups per day — the shape of growth, not a list of people.
      const signupsByDay: Record<string, number> = {};
      for (const p of (profiles ?? []) as { created_at: string }[]) {
        const day = p.created_at.slice(0, 10);
        if (p.created_at >= since) signupsByDay[day] = (signupsByDay[day] ?? 0) + 1;
      }

      // Where connections actually die. A funnel that only shows the happy path hides the
      // one number worth acting on: how many people never get past Introduction.
      const funnel: Record<string, number> = {};
      for (const m of (matches ?? []) as { stage: string; deleted_at: string | null }[]) {
        const key = m.deleted_at && m.stage !== 'terminated' ? 'terminated' : m.stage;
        funnel[key] = (funnel[key] ?? 0) + 1;
      }

      const revenue: Record<string, number> = {};
      for (const p of (payments ?? []) as { amount: number; currency: string; status: string }[]) {
        if (p.status !== 'activated' && p.status !== 'succeeded') continue;
        revenue[p.currency] = (revenue[p.currency] ?? 0) + Number(p.amount);
      }

      const checked = (mods ?? []).length;
      const blocked = ((mods ?? []) as { verdict: string }[]).filter((m) => m.verdict !== 'allowed').length;

      const aiRows = (ai ?? []) as { feature: string; status: string; total_tokens: number | null }[];
      const aiByFeature: Record<string, { calls: number; errors: number; tokens: number }> = {};
      for (const r of aiRows) {
        const f = (aiByFeature[r.feature] ??= { calls: 0, errors: 0, tokens: 0 });
        f.calls += 1;
        if (r.status !== 'ok') f.errors += 1;
        f.tokens += r.total_tokens ?? 0;
      }

      const profileRows = (profiles ?? []) as {
        created_at: string;
        verification_status: string;
        subscription_tier: string;
        gender: string | null;
        dob: string | null;
        country: string | null;
        city: string | null;
        status: string;
      }[];

      const verified = profileRows.filter((p) => p.verification_status === 'verified').length;
      const paid = profileRows.filter((p) => p.subscription_tier !== 'free').length;
      const total = profileRows.length;
      const verifiedRate = total ? Math.round((verified / total) * 100) : 0;
      const paidRate = verified ? Math.round((paid / verified) * 100) : 0;

      // User Analytics — demographics. Country/city are capped to the top 10 with
      // everything else folded into "other", so a rare (potentially identifying)
      // location never appears on its own as a named bucket.
      const demographics = {
        gender: tally(profileRows.map((p) => p.gender ?? 'unknown')),
        ageGroup: tally(profileRows.map((p) => ageGroup(ageFromDob(p.dob)))),
        country: topWithOther(tally(profileRows.map((p) => p.country ?? 'unknown')), 10),
        city: topWithOther(tally(profileRows.map((p) => p.city ?? 'unknown')), 10),
      };

      // Communication Analytics — categories only, never content (Part D categories).
      const modRows = (mods ?? []) as { verdict: string; category: string | null }[];
      const blockedByCategory = tally(
        modRows.filter((m) => m.verdict !== 'allowed').map((m) => m.category ?? 'none'),
      );

      // Support Analytics.
      const ticketRows = (tickets ?? []) as { category: string; status: string }[];
      const ticketsByCategory = tally(ticketRows.map((t) => t.category));
      const ticketsByStatus = tally(ticketRows.map((t) => t.status));

      // Safety monitoring (the "AI Dashboard" safety view) — built from what this
      // platform actually instruments: the violation ladder and moderation log.
      // There is no prompt-injection/abuse-pattern detector anywhere in the codebase
      // to report on; fabricating one here would be worse than not having the panel.
      const violationRows = (violations ?? []) as {
        category: string;
        severity: number;
        requires_review: boolean;
        reviewed_at: string | null;
      }[];
      const safety = {
        violationsByCategory: tally(violationRows.map((v) => v.category)),
        flaggedForReview: violationRows.filter((v) => v.requires_review && !v.reviewed_at).length,
        suspendedAccounts: profileRows.filter((p) => p.status === 'suspended').length,
        bannedAccounts: profileRows.filter((p) => p.status === 'banned').length,
        moderationUnavailableCount: blockedByCategory['unavailable'] ?? 0,
      };

      // Business Intelligence — deterministic, rule-based sentences from the numbers
      // above (no AI key required), same tradeoff as the rest of this platform's
      // "AI-shaped" features. Returned as {key, params} so the frontend renders the
      // actual sentence via i18n — copy lives in one place, not duplicated here.
      const insights: { key: string; params?: Record<string, unknown> }[] = [];
      if (total > 0 && verifiedRate >= 70) insights.push({ key: 'goodVerification', params: { rate: verifiedRate } });
      else if (total >= 10 && verifiedRate < 40) insights.push({ key: 'lowVerification', params: { rate: verifiedRate } });
      if (paid > 0) insights.push({ key: 'conversionRate', params: { rate: paidRate } });

      const sortedDays = Object.keys(signupsByDay).sort();
      if (sortedDays.length >= 4) {
        const mid = Math.floor(sortedDays.length / 2);
        const firstHalf = sortedDays.slice(0, mid).reduce((s, d) => s + signupsByDay[d], 0);
        const secondHalf = sortedDays.slice(mid).reduce((s, d) => s + signupsByDay[d], 0);
        if (firstHalf > 0) {
          const change = Math.round(((secondHalf - firstHalf) / firstHalf) * 100);
          if (Math.abs(change) >= 10) {
            insights.push({ key: change > 0 ? 'signupsUp' : 'signupsDown', params: { pct: Math.abs(change) } });
          }
        }
      }

      const blockRatePct = checked ? Math.round((blocked / checked) * 100) : 0;
      if (checked >= 5 && blockRatePct >= 15) insights.push({ key: 'highBlockRate', params: { rate: blockRatePct } });

      const topBlocked = Object.entries(blockedByCategory).sort((a, b) => b[1] - a[1])[0];
      if (topBlocked && topBlocked[0] !== 'none' && topBlocked[1] >= 3) {
        insights.push({ key: 'topBlockCategory', params: { category: topBlocked[0], count: topBlocked[1] } });
      }

      if (safety.flaggedForReview > 0) insights.push({ key: 'pendingReview', params: { count: safety.flaggedForReview } });

      return json({
        days,
        signupsByDay,
        funnel,
        revenue,
        moderation: { checked, blocked },
        ai: aiByFeature,
        conversion: {
          total,
          verified,
          paid,
          // The two numbers that decide whether this platform works at all.
          verifiedRate,
          paidRate,
        },
        demographics,
        communication: { blockedByCategory },
        support: { total: ticketRows.length, byCategory: ticketsByCategory, byStatus: ticketsByStatus },
        safety,
        matchTiming,
        topFilters,
        insights,
      });
    }

    if (action === 'coupons') {
      const { data } = await admin
        .from('coupons')
        .select('id, code, discount_type, discount_value, plan_restriction, expires_at, usage_limit, used_count, active')
        .order('created_at', { ascending: false });
      return json({ coupons: data ?? [] });
    }

    if (action === 'coupon-create') {
      const code = String(body.code ?? '').trim().toUpperCase();
      const discountType = body.discountType === 'fixed' ? 'fixed' : 'percent';
      const value = Number(body.value ?? 0);
      if (!code || !Number.isFinite(value) || value <= 0) return json({ error: 'bad_request' }, 400);
      if (discountType === 'percent' && value > 100) return json({ error: 'percent_over_100' }, 400);

      const { data, error } = await admin
        .from('coupons')
        .insert({
          code,
          discount_type: discountType,
          discount_value: value,
          plan_restriction: body.tier ? String(body.tier) : null,
          usage_limit: body.usageLimit ? Number(body.usageLimit) : null,
          expires_at: body.expiresAt ? new Date(String(body.expiresAt)).toISOString() : null,
        })
        .select('id')
        .single();
      if (error) return json({ error: error.message }, 400);

      await audit(admin, uid, 'coupon.created', 'coupon', data.id, null, { code, discountType, value });
      return json({ ok: true });
    }

    if (action === 'coupon-toggle') {
      const id = String(body.id ?? '');
      const active = Boolean(body.active);
      if (!id) return json({ error: 'bad_request' }, 400);
      // Deactivated, never deleted: a spent coupon is part of the payment record.
      await admin.from('coupons').update({ active }).eq('id', id);
      await audit(admin, uid, 'coupon.toggled', 'coupon', id, null, { active });
      return json({ ok: true });
    }

    if (action === 'jobs') {
      const { data } = await admin
        .from('scheduled_jobs')
        .select('name, schedule, enabled, last_run_at, last_result')
        .order('name');
      return json({ jobs: data ?? [] });
    }

    if (action === 'job-run') {
      const name = String(body.name ?? '');
      if (!name) return json({ error: 'name_required' }, 400);
      // Every job is idempotent by design, which is exactly what makes a "run now" button
      // safe to expose.
      const { data, error } = await admin.rpc('run_job', { job_name: name });
      if (error) return json({ error: error.message }, 400);
      await audit(admin, uid, 'job.run', 'scheduled_job', name, null, { result: data });
      return json({ ok: true, result: data });
    }

    if (action === 'job-toggle') {
      const name = String(body.name ?? '');
      const enabled = Boolean(body.enabled);
      if (!name) return json({ error: 'name_required' }, 400);
      await admin.from('scheduled_jobs').update({ enabled }).eq('name', name);
      await audit(admin, uid, 'job.toggled', 'scheduled_job', name, null, { enabled });
      return json({ ok: true });
    }

    if (action === 'audit') {
      const { data } = await admin
        .from('audit_logs')
        .select('id, actor_id, action, entity_type, entity_id, reason, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      const actorIds = [...new Set(((data ?? []) as { actor_id: string | null }[]).map((r) => r.actor_id).filter(Boolean))];
      const { data: profs } = await admin.from('profiles').select('id, display_name').in('id', actorIds as string[]);
      const nameById = new Map(
        ((profs ?? []) as { id: string; display_name: string | null }[]).map((p) => [p.id, p.display_name]),
      );
      return json({
        entries: ((data ?? []) as Record<string, unknown>[]).map((r) => ({
          ...r,
          actorName: r.actor_id ? (nameById.get(String(r.actor_id)) ?? null) : null,
        })),
      });
    }

    if (action === 'tickets') {
      const { data } = await admin
        .from('support_tickets')
        .select('id, user_id, category, subject, body, status, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      return json({ tickets: data ?? [] });
    }

    if (action === 'ticket-update') {
      const id = String(body.id ?? '');
      const status = String(body.status ?? '');
      if (!id || !['open', 'in_progress', 'closed'].includes(status)) return json({ error: 'bad_request' }, 400);
      await admin.from('support_tickets').update({ status }).eq('id', id);
      await audit(admin, uid, 'ticket.updated', 'support_ticket', id, null, { status });
      return json({ ok: true });
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'unexpected_error' }, 500);
  }
});
