-- Guardian / family system.
-- What: guardian invitations (email or code), the verified-guardian relationship
--       (soft-deleted, improvement #1), explicit per-introduction access grants,
--       and the meeting (رؤية شرعية) planner.
-- Why: the platform's most unusual permission shape — "access by explicit share
--      only." A guardian never browses; they see only introductions the woman
--      shared. The platform never claims to have verified the actual relationship.

create table public.guardian_invitations (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references auth.users (id) on delete cascade, -- the woman
  match_id uuid references public.matches (id) on delete cascade,
  relationship text not null, -- father | mother | brother | uncle | wali | other
  guardian_name text,
  guardian_email text,
  guardian_phone text,
  language text default 'ar',
  note text,
  invite_code text not null unique default encode(extensions.gen_random_bytes(9), 'hex'),
  status text not null default 'pending', -- pending | accepted | expired | cancelled
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  expires_at timestamptz
);
create index guardian_invitations_inviter_idx on public.guardian_invitations (inviter_id, status);

create table public.guardians (
  id uuid primary key default gen_random_uuid(),
  guardian_user_id uuid not null references auth.users (id) on delete cascade,
  ward_id uuid not null references auth.users (id) on delete cascade, -- the woman
  relationship text not null,
  declared boolean not null default true, -- declared by the ward
  confirmed boolean not null default false, -- confirmed by the guardian
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null,
  unique (guardian_user_id, ward_id)
);

create table public.guardian_access (
  id uuid primary key default gen_random_uuid(),
  guardian_user_id uuid not null references auth.users (id) on delete cascade,
  match_id uuid not null references public.matches (id) on delete cascade,
  granted_by uuid not null references auth.users (id) on delete cascade, -- the woman
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (guardian_user_id, match_id)
);

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  proposed_date timestamptz,
  location text,
  notes text,
  checklist jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index meetings_match_idx on public.meetings (match_id);

create trigger guardians_set_updated_at before update on public.guardians for each row execute function public.set_updated_at();
create trigger meetings_set_updated_at before update on public.meetings for each row execute function public.set_updated_at();

-- Does the current guardian have an active grant to this match?
create or replace function public.guardian_has_access(target uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.guardian_access g
    where g.match_id = target
      and g.guardian_user_id = auth.uid()
      and g.revoked_at is null
  );
$$;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.guardian_invitations enable row level security;
alter table public.guardians enable row level security;
alter table public.guardian_access enable row level security;
alter table public.meetings enable row level security;

create policy guardian_invitations_read_own on public.guardian_invitations
  for select using (inviter_id = auth.uid() or public.is_admin());

create policy guardians_read_involved on public.guardians
  for select using (
    deleted_at is null and (guardian_user_id = auth.uid() or ward_id = auth.uid() or public.is_admin())
  );

create policy guardian_access_read_involved on public.guardian_access
  for select using (
    guardian_user_id = auth.uid() or granted_by = auth.uid()
    or public.is_match_participant(match_id) or public.is_admin()
  );

-- Meetings: the couple and any guardian explicitly granted access to the match.
create policy meetings_read_involved on public.meetings
  for select using (public.is_match_participant(match_id) or public.guardian_has_access(match_id));

create policy meetings_write_participant on public.meetings
  for insert with check (public.is_match_participant(match_id));

create policy meetings_update_participant on public.meetings
  for update using (public.is_match_participant(match_id)) with check (public.is_match_participant(match_id));
