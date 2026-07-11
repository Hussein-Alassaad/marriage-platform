-- Stage consents — mutual agreement to advance the journey.
-- What: one row per (match, user, target stage). A match only advances when BOTH
--       participants have consented to the same next stage and the stage's own
--       requirements are met (Decisions Part D §2–§4).
-- Why: "both users explicitly choose to continue" must be a recorded fact, not a
--      client assertion. Written only by the `stage-transition` Edge Function
--      (service_role); clients can read their own match's consents and nothing more.

create table public.stage_consents (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  to_stage public.journey_stage not null,
  created_at timestamptz not null default now(),
  unique (match_id, user_id, to_stage)
);
comment on table public.stage_consents is 'Both participants must consent before a match advances. Client-read-only.';

create index stage_consents_match_idx on public.stage_consents (match_id, to_stage);

alter table public.stage_consents enable row level security;

create policy stage_consents_read_participant on public.stage_consents
  for select using (public.is_match_participant(match_id) or public.is_admin());

-- Never client-writable (RLS is deny-by-default; the explicit revoke also blocks
-- any future permissive policy from granting writes by accident).
revoke insert, update, delete on public.stage_consents from anon, authenticated;

-- Admin-configurable gate for the Serious stage (Part D §2: both users must hold an
-- active Serious Member or Marriage Plus subscription). Kept in settings, never in code.
insert into public.settings (key, value, type, is_public, description) values
  ('serious_stage_requires_paid', 'true', 'boolean', true, 'Both users need a paid tier to enter Serious Communication')
on conflict (key) do nothing;
