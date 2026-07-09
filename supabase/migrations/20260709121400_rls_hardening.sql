-- Security hardening — belt-and-suspenders on the most sensitive tables.
-- What: revoke INSERT/UPDATE/DELETE from anon + authenticated on tables that must
--       only ever be written server-side (Edge Functions run as service_role,
--       which bypasses both RLS and these grants).
-- Why: RLS with no write policy already blocks client writes; this makes a future
--      accidental policy the difference between "still safe" and "breach".

do $$
declare
  t text;
  protected text[] := array[
    'messages', 'matches', 'stage_history', 'message_moderation',
    'interests', 'compatibility_scores', 'daily_recommendations', 'served_recommendations',
    'identity_verifications', 'verification_badges', 'risk_scores',
    'subscriptions', 'payments', 'subscription_plans', 'coupons',
    'settings', 'settings_history', 'audit_logs', 'scheduled_jobs',
    'notification_events', 'notification_templates', 'prompt_templates',
    'ai_requests', 'conversations', 'conversation_participants',
    'message_counters', 'daily_media_counters', 'violations',
    'guardians', 'guardian_invitations', 'guardian_access',
    'shared_finance', 'financial_reports', 'exchange_rates'
  ];
begin
  foreach t in array protected loop
    execute format('revoke insert, update, delete on public.%I from anon, authenticated;', t);
  end loop;
end $$;

-- Notifications: clients may only UPDATE (mark read / soft-delete) — never insert
-- or hard-delete. Inserts come from the dispatch Edge Function.
revoke insert, delete on public.notifications from anon, authenticated;
