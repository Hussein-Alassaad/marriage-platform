-- Privacy toggles (PRD Part 5 "Privacy Controls"): Online Status, Read Receipts,
-- Activity Status. Found missing in the requirements audit — no fields for any of
-- the three existed anywhere. Real fields, not dead ones: `last_active_at` backs
-- online/activity status (updated by the client on its own profile, same column-
-- grant pattern as every other self-editable field), and `messages.read_at` backs
-- read receipts (a participant may mark a message from the OTHER person as read —
-- never their own — mirroring the profiles precedent: REVOKE the broad UPDATE,
-- GRANT back only the one column that's safe to expose).
--
-- The three toggles themselves live in the existing `privacy` jsonb column (already
-- client-writable) as `onlineStatus`/`activityStatus`/`readReceipts` booleans,
-- default true — nothing new to grant for those.

alter table public.profiles
  add column if not exists last_active_at timestamptz;

-- Extend the self-editable column grant (Phase 14) to include the new column.
-- CREATE OR REPLACE isn't available for GRANT; re-issuing it is idempotent.
grant update (
  display_name, dob, gender, nationality, country, city, languages,
  education_level, university, major, graduation_year,
  occupation, industry, employment_status, career_goals,
  marriage_goals, lifestyle, family_values, financial_readiness,
  bio, photo_privacy_mode, privacy, profile_completion, last_active_at
) on public.profiles to authenticated;

-- Read receipts: a participant may mark a message the OTHER person sent as read.
-- Never their own — that would let someone fake a "seen" on their own message.
alter table public.messages
  add column if not exists read_at timestamptz;

create policy messages_mark_read on public.messages
  for update using (
    sender_id <> auth.uid() and public.is_conversation_participant(conversation_id)
  )
  with check (
    sender_id <> auth.uid() and public.is_conversation_participant(conversation_id)
  );

revoke update on public.messages from anon, authenticated;
grant update (read_at) on public.messages to authenticated;
