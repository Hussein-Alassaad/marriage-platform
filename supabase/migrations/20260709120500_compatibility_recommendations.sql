-- Compatibility & recommendations.
-- What: deterministic compatibility sub-scores, the tiered daily recommendation
--       list, a served-log to avoid repeats, and per-user saved/viewed/declined.
-- Why: quality-over-quantity matching (Official AI recommendation decision).
--      Scores/recs are computed server-side (batch job); users only ever read
--      their own. Saving/viewing/declining are simple personal writes.

create or replace function public.is_paid()
returns boolean
language sql
security definer
stable
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.subscription_tier in ('serious', 'marriage_plus')
  );
$$;

create table public.compatibility_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  candidate_id uuid not null references auth.users (id) on delete cascade,
  overall smallint not null,
  breakdown jsonb not null default '{}', -- religion, values, personality, goals, lifestyle, distance, financial, communication
  computed_at timestamptz not null default now(),
  unique (user_id, candidate_id),
  constraint compatibility_distinct check (user_id <> candidate_id)
);
create index compatibility_user_idx on public.compatibility_scores (user_id, overall desc);

create table public.daily_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  candidate_id uuid not null references auth.users (id) on delete cascade,
  rec_date date not null default current_date,
  rank smallint,
  created_at timestamptz not null default now(),
  unique (user_id, candidate_id, rec_date)
);
create index daily_recommendations_user_date_idx on public.daily_recommendations (user_id, rec_date desc, rank);

create table public.served_recommendations (
  user_id uuid not null references auth.users (id) on delete cascade,
  candidate_id uuid not null references auth.users (id) on delete cascade,
  first_served_at timestamptz not null default now(),
  times_served integer not null default 1,
  primary key (user_id, candidate_id)
);

create table public.saved_profiles (
  user_id uuid not null references auth.users (id) on delete cascade,
  candidate_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, candidate_id)
);

create table public.viewed_profiles (
  user_id uuid not null references auth.users (id) on delete cascade,
  candidate_id uuid not null references auth.users (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (user_id, candidate_id)
);

create table public.declined_profiles (
  user_id uuid not null references auth.users (id) on delete cascade,
  candidate_id uuid not null references auth.users (id) on delete cascade,
  declined_at timestamptz not null default now(),
  primary key (user_id, candidate_id)
);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.compatibility_scores enable row level security;
alter table public.daily_recommendations enable row level security;
alter table public.served_recommendations enable row level security;
alter table public.saved_profiles enable row level security;
alter table public.viewed_profiles enable row level security;
alter table public.declined_profiles enable row level security;

-- Engine-computed: read own only, no client writes.
create policy compatibility_read_own on public.compatibility_scores
  for select using (user_id = auth.uid());
create policy daily_recs_read_own on public.daily_recommendations
  for select using (user_id = auth.uid());
create policy served_recs_read_own on public.served_recommendations
  for select using (user_id = auth.uid());

-- Personal collections: read + write own rows.
create policy saved_read_own on public.saved_profiles
  for select using (user_id = auth.uid());
create policy saved_write_own on public.saved_profiles
  for insert with check (user_id = auth.uid());
create policy saved_delete_own on public.saved_profiles
  for delete using (user_id = auth.uid());

create policy viewed_read_own on public.viewed_profiles
  for select using (user_id = auth.uid());
create policy viewed_write_own on public.viewed_profiles
  for insert with check (user_id = auth.uid());

create policy declined_read_own on public.declined_profiles
  for select using (user_id = auth.uid());
create policy declined_write_own on public.declined_profiles
  for insert with check (user_id = auth.uid());
