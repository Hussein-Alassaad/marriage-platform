// The silent-failure traps (Runbook §1). Each of these can be broken for a week
// without a single error appearing anywhere — which is exactly why they are
// checked explicitly, rather than waited on. Shared by the `admin` function's
// `health` action (what an admin sees on the dashboard) and the public
// `health-check` function (what an external uptime monitor pings) so the two can
// never disagree about what "healthy" means.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface HealthCheck {
  key: string;
  ok: boolean;
  detail: string;
}

async function setting<T>(admin: SupabaseClient, key: string, fallback: T): Promise<T> {
  const { data } = await admin.from('settings').select('value').eq('key', key).maybeSingle();
  return (data?.value ?? fallback) as T;
}

async function countWhere(admin: SupabaseClient, table: string, column: string, value: string): Promise<number> {
  const { count } = await admin.from(table).select('id', { count: 'exact', head: true }).eq(column, value);
  return count ?? 0;
}

/**
 * How long a job can go without running before it counts as "stale" — inferred
 * from its own cron schedule rather than one fixed number. A blanket 36-hour rule
 * flags `monthly_finance_reports` (`0 3 1 * *`) as broken every single day except
 * the 1st, which is exactly the kind of false alarm that trains people to ignore
 * a monitor. Parses the standard 5-field cron string (min hour day month weekday).
 */
function staleThresholdMs(schedule: string): number {
  const parts = schedule.trim().split(/\s+/);
  const [minute, hour, dayOfMonth] = parts.length === 5 ? parts : ['*', '*', '*'];
  if (dayOfMonth !== '*') return 32 * 24 * 3600e3; // runs on a specific day of the month
  if (hour === '*') return 2 * 3600e3; // runs multiple times per hour (e.g. */15 * * * *)
  if (minute === '*') return 3600e3; // runs every minute of a specific hour range (rare)
  return 36 * 3600e3; // the common case: once a day
}

export async function runHealthChecks(admin: SupabaseClient): Promise<{ checks: HealthCheck[]; healthy: boolean }> {
  const checks: HealthCheck[] = [];

  // 1. Moderation. The dangerous state is not "off" — it is "on, but the key is gone",
  //    which fails closed and silently blocks every message on the platform.
  const aiEnabled = await setting(admin, 'moderation_ai_enabled', true);
  const hasKey = Boolean(Deno.env.get('ANTHROPIC_API_KEY'));
  checks.push({
    key: 'moderation',
    ok: !aiEnabled || hasKey,
    detail: !aiEnabled ? 'local_only' : hasKey ? 'ai_enabled' : 'ai_enabled_but_no_key',
  });

  // 2. Jobs that have not run when they should have — judged against EACH job's own
  //    schedule, not one blanket number (see staleThresholdMs).
  const { data: jobs } = await admin.from('scheduled_jobs').select('name, schedule, enabled, last_run_at, last_result');
  const stale = (
    (jobs ?? []) as { name: string; schedule: string; enabled: boolean; last_run_at: string | null }[]
  )
    .filter((j) => j.enabled)
    .filter((j) => !j.last_run_at || Date.now() - new Date(j.last_run_at).getTime() > staleThresholdMs(j.schedule));
  const failing = ((jobs ?? []) as { name: string; last_result: string | null }[]).filter((j) =>
    j.last_result?.startsWith('error:'),
  );
  checks.push({
    key: 'jobs',
    ok: !stale.length && !failing.length,
    detail:
      [
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
  const ageDays = rate?.as_of ? Math.floor((Date.now() - new Date(rate.as_of).getTime()) / 864e5) : Infinity;
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

  return { checks, healthy: checks.every((c) => c.ok) };
}
