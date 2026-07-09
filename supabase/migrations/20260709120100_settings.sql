-- Settings engine — the "no hardcoded values" backbone.
-- What: a typed key/value store admins edit, plus an immutable settings_history
--       that auto-records every change (approved improvement #4).
-- Why: every platform limit/price/flag is a row here, changeable without a
--      deploy; the history gives full auditability and a rollback trail.

create table public.settings (
  key text primary key,
  value jsonb not null,
  type public.setting_type not null,
  is_public boolean not null default false, -- readable by the frontend?
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
comment on table public.settings is 'Admin-configurable platform settings. No client writes; changed via admin Edge Functions.';

create table public.settings_history (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null,
  previous_value jsonb,
  new_value jsonb not null,
  changed_by uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now()
);
comment on table public.settings_history is 'Immutable audit trail of every settings change (append-only).';

create index settings_history_key_idx on public.settings_history (setting_key, changed_at desc);

-- Auto-log every insert/update of a setting's value into settings_history.
create or replace function public.log_settings_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if tg_op = 'UPDATE' and new.value is not distinct from old.value then
    return new; -- value unchanged; nothing to log
  end if;
  insert into public.settings_history (setting_key, previous_value, new_value, changed_by)
  values (new.key, case when tg_op = 'UPDATE' then old.value else null end, new.value, auth.uid());
  return new;
end;
$$;

create trigger settings_log_change
  after insert or update of value on public.settings
  for each row execute function public.log_settings_change();

create trigger settings_set_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

-- History is append-only.
create trigger settings_history_immutable
  before update or delete on public.settings_history
  for each row execute function public.prevent_mutation();

-- ── Seeds — default configuration ───────────────────────────────────────────
insert into public.settings (key, value, type, is_public, description) values
  ('intro_messages_per_person', '10', 'number', true, 'Introduction Stage message limit per person'),
  ('free_interests_per_day', '5', 'number', true, 'Interest requests per day for Free members'),
  ('conversation_summary_interval', '20', 'number', false, 'Generate an AI conversation summary every N messages (paid tiers)'),
  ('rerequest_cooldown_days', '30', 'number', true, 'Cooldown before the same pair can re-request after termination'),
  ('min_age', '18', 'number', true, 'Minimum age (per deployment region law)'),
  ('moderation_strictness_default', '"strict"', 'string', false, 'Default AI moderation mode'),
  ('daily_recs_free', '10', 'number', true, 'New AI recommendations per day — Free'),
  ('daily_recs_serious', '25', 'number', true, 'New AI recommendations per day — Serious'),
  ('daily_recs_marriage_plus', '50', 'number', true, 'New AI recommendations per day — Marriage Plus'),
  ('plus_refresh_per_day', '3', 'number', false, 'Marriage Plus recommendation refreshes per day'),
  ('family_images_per_day', '3', 'number', true, 'Family Stage image messages per day (per user)'),
  ('family_videos_per_day', '2', 'number', true, 'Family Stage video messages per day (per user)'),
  ('basic_shared_finance_tier', '"serious"', 'string', false, 'Minimum tier for basic shared finance (Married Stage still required)'),
  ('wali_mode', '"recommended"', 'string', false, 'Guardian workflow: recommended | guided | strict'),
  ('session_inactivity_minutes', '60', 'number', false, 'Session expiry after inactivity'),
  ('ai_daily_conversations_free', '5', 'number', false, 'Marriage Assistant daily conversations — Free'),
  ('ai_daily_conversations_serious', '50', 'number', false, 'Marriage Assistant daily conversations — Serious');

-- ── RLS: public settings readable by anyone; everything by admins; no client writes ──
alter table public.settings enable row level security;
alter table public.settings_history enable row level security;

create policy settings_read_public on public.settings
  for select using (is_public = true or public.is_admin());

create policy settings_history_read_admin on public.settings_history
  for select using (public.is_admin());
