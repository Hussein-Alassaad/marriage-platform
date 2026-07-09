-- Notifications — one event-driven "post office".
-- What: an events inbox features emit into, the delivered in-app notifications
--       (soft-deleted, improvement #1), bilingual templates, and per-user
--       preferences (channels, quiet hours, digest).
-- Why: features never notify directly — they emit an event; the dispatch Edge
--      Function applies preferences and delivers. Preferences are enforced
--      server-side in exactly one place.

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null, -- interest.accepted, guardian.invited, payment.approved, stage.married, …
  user_id uuid references auth.users (id) on delete cascade, -- target (if known)
  payload jsonb not null default '{}',
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
create index notification_events_unprocessed_idx on public.notification_events (created_at) where processed_at is null;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null, -- match | chat | finance | assistant | family | verification | subscription | admin | system
  type text not null,
  title text not null,
  body text,
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null
);
create index notifications_user_idx on public.notifications (user_id, created_at desc) where deleted_at is null;
create index notifications_unread_idx on public.notifications (user_id) where read_at is null and deleted_at is null;

create table public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  locale text not null default 'en',
  title text not null,
  body text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (type, locale)
);
create trigger notification_templates_set_updated_at before update on public.notification_templates for each row execute function public.set_updated_at();

create table public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  channels jsonb not null default '{"in_app": true, "email": false, "sms": false, "whatsapp": false, "push": false}',
  quiet_hours jsonb not null default '{}',
  digest_mode text not null default 'immediate', -- immediate | daily | weekly | none
  categories jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
create trigger notification_preferences_set_updated_at before update on public.notification_preferences for each row execute function public.set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.notification_events enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_templates enable row level security;
alter table public.notification_preferences enable row level security;

-- Events are internal; admins may inspect. No client access otherwise.
create policy notification_events_read_admin on public.notification_events
  for select using (public.is_admin());

-- Notifications: owner reads; owner may mark read / soft-delete (update). Inserts
-- come only from the dispatch Edge Function.
create policy notifications_read_own on public.notifications
  for select using (user_id = auth.uid() and deleted_at is null);
create policy notifications_update_own on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy notification_templates_read_admin on public.notification_templates
  for select using (public.is_admin());

create policy notification_preferences_rw_own on public.notification_preferences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
