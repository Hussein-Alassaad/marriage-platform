-- Lock down SECURITY DEFINER functions from Phases 13-14 that were never
-- restricted to service_role — the exact bug class already found and fixed for
-- run_job/compute_compatibility_for_user in 20260725100000_daily_match_generation.sql,
-- just missed for the functions that migration's own file (20260714160000_scheduled_jobs.sql)
-- and its neighbors originally defined.
--
-- Postgres grants EXECUTE to PUBLIC by default. Any of these being callable
-- directly via PostgREST RPC (`/rest/v1/rpc/<name>`) by an authenticated (or
-- anon) client bypasses whatever gate the calling code was supposed to enforce:
--   • the seven job_* functions bypass run_job()'s `enabled` check entirely —
--     e.g. job_cleanup_identity_documents() could be forced to delete identity
--     documents ahead of the configured grace period, or job_expire_subscriptions()
--     forced to downgrade a tier early.
--   • deliver_notification_event(event_id, force) accepts an arbitrary event id
--     and a `force` flag that bypasses quiet-hours/digest preferences.
--   • is_account_active(uid) accepts an arbitrary uid — read-only, so this is an
--     information-disclosure gap (whether an arbitrary account is suspended),
--     not a privileged write, but the same unlocked-by-default pattern.
--
-- None of these are referenced inside any RLS policy (checked: only run_job and
-- the cron schedule call them, both server-side), so locking them to service_role
-- cannot break RLS evaluation for ordinary authenticated queries.

revoke execute on function public.job_flush_notifications() from public, anon, authenticated;
grant execute on function public.job_flush_notifications() to service_role;

revoke execute on function public.job_expire_payment_claims() from public, anon, authenticated;
grant execute on function public.job_expire_payment_claims() to service_role;

revoke execute on function public.job_subscription_reminders() from public, anon, authenticated;
grant execute on function public.job_subscription_reminders() to service_role;

revoke execute on function public.job_expire_subscriptions() from public, anon, authenticated;
grant execute on function public.job_expire_subscriptions() to service_role;

revoke execute on function public.job_cleanup_identity_documents() from public, anon, authenticated;
grant execute on function public.job_cleanup_identity_documents() to service_role;

revoke execute on function public.job_fetch_exchange_rates() from public, anon, authenticated;
grant execute on function public.job_fetch_exchange_rates() to service_role;

revoke execute on function public.job_collect_exchange_rates() from public, anon, authenticated;
grant execute on function public.job_collect_exchange_rates() to service_role;

revoke execute on function public.deliver_notification_event(uuid, boolean) from public, anon, authenticated;
grant execute on function public.deliver_notification_event(uuid, boolean) to service_role;

revoke execute on function public.is_account_active(uuid) from public, anon, authenticated;
grant execute on function public.is_account_active(uuid) to service_role;
