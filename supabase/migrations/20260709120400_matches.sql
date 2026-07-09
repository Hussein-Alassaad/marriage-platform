-- Matches, journey state, and interest requests.
-- What: ONE matches row per pair carrying the canonical journey_stage; an
--       append-only stage_history; and interest requests. Soft-deleted.
-- Why: a single enum column makes conflicting stage models physically
--      impossible. Stage changes happen only via the stage-transition Edge
--      Function (service_role); clients cannot write these tables.

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users (id) on delete cascade,
  user_b uuid not null references auth.users (id) on delete cascade,
  stage public.journey_stage not null default 'interest_sent',
  initiated_by uuid references auth.users (id) on delete set null,
  cooldown_until timestamptz, -- re-request cooldown after termination
  terminated_at timestamptz,
  terminated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null,
  constraint matches_distinct_users check (user_a <> user_b),
  constraint matches_canonical_order check (user_a < user_b), -- normalized pair
  unique (user_a, user_b)
);
comment on table public.matches is 'One row per pair; stage is the canonical journey state. Client-read-only.';

create index matches_user_a_idx on public.matches (user_a, stage) where deleted_at is null;
create index matches_user_b_idx on public.matches (user_b, stage) where deleted_at is null;

create trigger matches_set_updated_at
  before update on public.matches
  for each row execute function public.set_updated_at();

create table public.stage_history (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  from_stage public.journey_stage,
  to_stage public.journey_stage not null,
  changed_by uuid references auth.users (id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);
create index stage_history_match_idx on public.stage_history (match_id, created_at);

create trigger stage_history_immutable
  before update or delete on public.stage_history
  for each row execute function public.prevent_mutation();

create table public.interests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  status public.interest_status not null default 'sent',
  note text, -- AI-moderated introduction note
  match_id uuid references public.matches (id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  expires_at timestamptz,
  constraint interests_distinct check (sender_id <> recipient_id)
);
create index interests_recipient_idx on public.interests (recipient_id, status);
create index interests_sender_idx on public.interests (sender_id, created_at desc);

-- Participant check for match-scoped policies (SECURITY DEFINER to avoid recursion).
create or replace function public.is_match_participant(target uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.matches m
    where m.id = target
      and m.deleted_at is null
      and (m.user_a = auth.uid() or m.user_b = auth.uid())
  );
$$;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.matches enable row level security;
alter table public.stage_history enable row level security;
alter table public.interests enable row level security;

create policy matches_read_participant on public.matches
  for select using (
    (deleted_at is null and (user_a = auth.uid() or user_b = auth.uid()))
    or public.is_admin()
  );

create policy stage_history_read_participant on public.stage_history
  for select using (public.is_match_participant(match_id) or public.is_admin());

create policy interests_read_involved on public.interests
  for select using (sender_id = auth.uid() or recipient_id = auth.uid() or public.is_admin());
