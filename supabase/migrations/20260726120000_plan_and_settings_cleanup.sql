-- Cleanup found in the same audit that surfaced the tiered-recommendations gap:
-- one plan feature that was promised but never built, and two settings that were
-- seeded in Phase 2 and never read anywhere.
--
-- `priority` (Marriage Plus plan feature, "Priority support and visibility"): no
-- priority support queue or ranking boost exists anywhere in the codebase, and the
-- phrase has no clear technical meaning to build toward. `advanced_filters`
-- (Serious plan feature) is NOT touched here — it is now real, wired in
-- 20260726110000_tiered_recommendations.sql's sibling changes to matchmaking's
-- discover action.
--
-- `moderation_strictness_default`: moderation mode is governed entirely by
-- `moderation_ai_enabled` (see CLAUDE.md's "Moderation mode" section) — this
-- setting was never read by any Edge Function or the moderation pre-filter.
--
-- `wali_mode`: the guardian flow (invite → accept → grant-access) has no branching
-- on a mode at all; `supabase/functions/guardian/index.ts` never reads this key.
--
-- `session_inactivity_minutes` is NOT removed here — it is being wired up for
-- real (see the session-timeout migration/feature landing alongside this one).

update public.subscription_plans
set features = features - 'priority'
where tier = 'marriage_plus';

delete from public.settings where key in ('moderation_strictness_default', 'wali_mode');
