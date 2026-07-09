-- Profiles & roles.
-- What: user_roles (multi-role capable) and the marriage profile, created
--       automatically for every new auth user; gender locks after verification;
--       min age is enforced from settings; soft delete preserves history.
-- Why: the trust foundation. RLS keeps a profile private to its owner (+admins);
--      cross-user discovery arrives with matching (Phase 7) via a curated view.

-- Small typed settings accessors (used by triggers/policies).
create or replace function public.setting_number(target text)
returns numeric
language sql
security definer
stable
set search_path = public, pg_catalog
as $$
  select (value #>> '{}')::numeric from public.settings where key = target;
$$;

-- ── Roles ───────────────────────────────────────────────────────────────────
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.user_role not null default 'user',
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
create index user_roles_user_idx on public.user_roles (user_id);

-- ── Profiles ────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  legal_first_name text, -- private, never in public views
  dob date,
  gender public.gender,
  gender_locked boolean not null default false,
  nationality text,
  country text,
  city text,
  languages text[] not null default '{}',
  education_level text,
  university text,
  major text,
  graduation_year smallint,
  occupation text,
  industry text,
  employment_status text,
  career_goals text,
  marriage_goals jsonb not null default '{}',
  lifestyle jsonb not null default '{}',
  family_values jsonb not null default '{}',
  financial_readiness jsonb not null default '{}',
  bio text,
  photo_privacy_mode smallint not null default 2 check (photo_privacy_mode between 1 and 4),
  privacy jsonb not null default '{}',
  profile_completion smallint not null default 0,
  quality_score smallint,
  readiness_score smallint,
  verification_status public.verification_status not null default 'unverified',
  subscription_tier public.subscription_tier not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null
);
comment on table public.profiles is 'Marriage profile, 1:1 with auth.users. Soft-deleted, not hard-deleted.';

-- Filter/discovery indexes (used by matching in later phases).
create index profiles_gender_idx on public.profiles (gender) where deleted_at is null;
create index profiles_country_city_idx on public.profiles (country, city) where deleted_at is null;
create index profiles_verification_idx on public.profiles (verification_status) where deleted_at is null;
create index profiles_education_idx on public.profiles (education_level) where deleted_at is null;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Gender cannot change once locked (locked on successful verification, Decision #8).
create or replace function public.enforce_gender_lock()
returns trigger
language plpgsql
as $$
begin
  if old.gender_locked and new.gender is distinct from old.gender then
    raise exception 'Gender is locked after identity verification and cannot be changed here';
  end if;
  return new;
end;
$$;
create trigger profiles_gender_lock
  before update on public.profiles
  for each row execute function public.enforce_gender_lock();

-- Enforce the configurable minimum age when a date of birth is set.
create or replace function public.enforce_min_age()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  min_years numeric := coalesce(public.setting_number('min_age'), 18);
begin
  if new.dob is not null and new.dob > (current_date - (min_years || ' years')::interval) then
    raise exception 'User must be at least % years old', min_years;
  end if;
  return new;
end;
$$;
create trigger profiles_min_age
  before insert or update of dob on public.profiles
  for each row execute function public.enforce_min_age();

-- ── New-user provisioning: profile + default 'user' role ────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  insert into public.profiles (id, display_name, gender)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    (nullif(new.raw_user_meta_data ->> 'gender', ''))::public.gender
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.user_roles enable row level security;
alter table public.profiles enable row level security;

-- Roles: a user may read their own; admins read all. No client writes (assigned
-- server-side via the signup trigger / admin actions).
create policy user_roles_read_own on public.user_roles
  for select using (user_id = auth.uid() or public.is_admin());

-- Profile: owner reads/updates own (while not deleted); admins read for moderation.
create policy profiles_read_own on public.profiles
  for select using ((id = auth.uid() and deleted_at is null) or public.is_admin());

create policy profiles_update_own on public.profiles
  for update using (id = auth.uid() and deleted_at is null)
  with check (id = auth.uid());
