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
// Actions: overview | settings-list | settings-update | users-search | user-status |
//          verification-queue | verification-review | jobs | job-run | audit | tickets |
//          ticket-update
//
// Deploy: `supabase functions deploy admin`.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { emit } from '../_shared/notify.ts';

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
      // The silent-failure traps. Each of these can be broken for a week without a single
      // error appearing anywhere — which is exactly why they are checked explicitly.
      const checks: { key: string; ok: boolean; detail: string }[] = [];

      // 1. Moderation. The dangerous state is not "off" — it is "on, but the key is gone",
      //    which fails closed and silently blocks every message on the platform.
      const aiEnabled = await setting(admin, 'moderation_ai_enabled', true);
      const hasKey = Boolean(Deno.env.get('ANTHROPIC_API_KEY'));
      checks.push({
        key: 'moderation',
        ok: !aiEnabled || hasKey,
        detail: !aiEnabled
          ? 'local_only'
          : hasKey
            ? 'ai_enabled'
            : 'ai_enabled_but_no_key', // every message is being blocked right now
      });

      // 2. Jobs that have not run when they should have.
      const { data: jobs } = await admin.from('scheduled_jobs').select('name, enabled, last_run_at, last_result');
      const stale = ((jobs ?? []) as { name: string; enabled: boolean; last_run_at: string | null }[])
        .filter((j) => j.enabled)
        .filter((j) => !j.last_run_at || Date.now() - new Date(j.last_run_at).getTime() > 36 * 3600e3);
      const failing = ((jobs ?? []) as { name: string; last_result: string | null }[]).filter((j) =>
        j.last_result?.startsWith('error:'),
      );
      checks.push({
        key: 'jobs',
        ok: !stale.length && !failing.length,
        detail: [
          stale.length ? `stale: ${stale.map((j) => j.name).join(', ')}` : '',
          failing.length ? `failing: ${failing.map((j) => j.name).join(', ')}` : '',
        ]
          .filter(Boolean)
          .join(' · ') || 'all running',
      });

      // 3. Exchange rates. A stale rate does not error — it quietly makes every figure on
      //    the finance page wrong, which is worse than an outage.
      const { data: rate } = await admin
        .from('exchange_rates')
        .select('as_of')
        .eq('base_currency', 'USD')
        .order('as_of', { ascending: false })
        .limit(1)
        .maybeSingle();
      const ageDays = rate?.as_of
        ? Math.floor((Date.now() - new Date(rate.as_of).getTime()) / 864e5)
        : Infinity;
      checks.push({
        key: 'exchange_rates',
        ok: ageDays <= 3,
        detail: Number.isFinite(ageDays) ? `${ageDays} days old` : 'never fetched',
      });

      // 4. Backlog: work waiting on a human. Not an outage, but a queue nobody is working
      //    is how a member waits a fortnight to be verified.
      const pendingVerifications = await countWhere(admin, 'identity_verifications', 'status', 'pending');
      const pendingClaims = await countWhere(admin, 'payment_claims', 'status', 'pending');
      checks.push({
        key: 'queues',
        ok: pendingVerifications < 20 && pendingClaims < 20,
        detail: `${pendingVerifications} verifications, ${pendingClaims} payments waiting`,
      });

      return json({ checks, healthy: checks.every((c) => c.ok) });
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
