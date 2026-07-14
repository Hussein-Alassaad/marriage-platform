-- Admin: account status, and the settings an admin is allowed to touch.
--
-- Two gaps this closes:
--
-- 1. There was no way to suspend or ban an account. A platform that hosts private
--    conversations between strangers and cannot remove someone who abuses that is not
--    finished. `status` is checked at the point of ACTION (sending a message, sending an
--    interest) rather than at login, because a suspension must bite immediately — a
--    session issued a minute earlier must not buy an hour of harassment.
--
-- 2. Settings were editable only by hand-written SQL, which defeats the entire point of
--    having built a settings engine. `settings_history` already records every change
--    (Phase 2 trigger), so an admin edit is auditable the moment it is allowed.

create type public.account_status as enum ('active', 'suspended', 'banned');

alter table public.profiles
  add column if not exists status public.account_status not null default 'active',
  add column if not exists suspended_until timestamptz,
  add column if not exists suspension_reason text;

-- A suspension that never lifts is a ban; make the distinction explicit and queryable.
create index profiles_status_idx on public.profiles (status) where status <> 'active';

-- Is this account allowed to act right now? Used by the Edge Functions at the point of
-- action. An expired suspension is treated as lifted without needing a job to sweep it —
-- the state is derived, not stored, so it can never be stale.
create or replace function public.is_account_active(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(
    (
      select p.status = 'active'
             or (p.status = 'suspended' and p.suspended_until is not null and p.suspended_until < now())
      from public.profiles p
      where p.id = uid
    ),
    false -- no profile ⇒ not active. Fail closed.
  );
$$;

-- Settings: admins may now write them. `updated_by` is set by the Edge Function, and the
-- Phase 2 trigger copies every change into the append-only settings_history.
create policy settings_write_admin on public.settings
  for update using (public.is_admin()) with check (public.is_admin());

-- Support tickets: a member opens and reads their own; admins see and work all of them.
create policy support_tickets_rw_own on public.support_tickets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy support_tickets_read_admin on public.support_tickets
  for select using (public.is_admin());
create policy support_tickets_update_admin on public.support_tickets
  for update using (public.is_admin()) with check (public.is_admin());

-- Only an admin may change an account's status, and only through the `admin` function
-- (which audits it). A client write here would be a self-unban.
revoke update on public.profiles from anon, authenticated;
grant update (
  display_name, dob, gender, nationality, country, city, languages,
  education_level, university, major, graduation_year,
  occupation, industry, employment_status, career_goals,
  marriage_goals, lifestyle, family_values, financial_readiness,
  bio, photo_privacy_mode, privacy, profile_completion
) on public.profiles to authenticated;
