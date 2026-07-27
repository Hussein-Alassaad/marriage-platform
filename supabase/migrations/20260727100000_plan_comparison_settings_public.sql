-- The Plans page comparison table (built this session) needs to show real, live
-- numbers for what each tier actually gets — AI Assistant conversations/day, the
-- Marriage Plus recommendation-refresh cap, and the two Couple Finance tier gates —
-- instead of hardcoded copy that would silently drift from the real values an admin
-- can already tune in Settings. None of these five are sensitive (same category as
-- session_inactivity_minutes, intro_messages_per_person: operational numbers members
-- are told about directly), so they need is_public = true to be readable by the
-- client at all — the settings RLS policy only allows is_public rows to non-admins.
update public.settings
set is_public = true
where key in (
  'ai_daily_conversations_free',
  'ai_daily_conversations_serious',
  'assistant_daily_marriage_plus',
  'basic_shared_finance_tier',
  'plus_refresh_per_day'
);
