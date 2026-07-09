-- Identity verification & trust.
-- What: verification records (document + selfie references live in the private
--       identity-documents bucket), derived badges, and an admin-only risk score.
-- Why: verification is the hard gate before matchmaking (Decision #5). Verifying
--      locks gender (Decision #8) and flips the profile to verified.

create table public.identity_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status public.verification_status not null default 'pending',
  document_type text,
  document_path text, -- path in the private identity-documents bucket
  selfie_path text,
  provider text, -- external IDV provider (mock until integrated)
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index identity_verifications_user_idx on public.identity_verifications (user_id, status);

create trigger identity_verifications_set_updated_at
  before update on public.identity_verifications
  for each row execute function public.set_updated_at();

create table public.verification_badges (
  user_id uuid not null references auth.users (id) on delete cascade,
  badge text not null, -- 'email' | 'phone' | 'identity'
  granted_at timestamptz not null default now(),
  primary key (user_id, badge)
);

-- Admin-only fraud signal. Never used to discriminate on protected characteristics.
create table public.risk_scores (
  user_id uuid primary key references auth.users (id) on delete cascade,
  score smallint not null default 0,
  signals jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
create trigger risk_scores_set_updated_at
  before update on public.risk_scores
  for each row execute function public.set_updated_at();

-- On successful verification: lock gender, flip profile status, grant the badge.
create or replace function public.apply_verification_result()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.status = 'verified' and old.status is distinct from 'verified' then
    update public.profiles
      set verification_status = 'verified', gender_locked = true
      where id = new.user_id;
    insert into public.verification_badges (user_id, badge)
      values (new.user_id, 'identity')
      on conflict (user_id, badge) do nothing;
  end if;
  return new;
end;
$$;
create trigger identity_verifications_apply_result
  after update of status on public.identity_verifications
  for each row execute function public.apply_verification_result();

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.identity_verifications enable row level security;
alter table public.verification_badges enable row level security;
alter table public.risk_scores enable row level security;

-- Users see their own verification status/badges; admins see all. No client
-- writes — the verify-identity Edge Function performs submissions and reviews.
create policy identity_verifications_read_own on public.identity_verifications
  for select using (user_id = auth.uid() or public.is_admin());

create policy verification_badges_read_own on public.verification_badges
  for select using (user_id = auth.uid() or public.is_admin());

-- Risk score is admin-only (never exposed to the user).
create policy risk_scores_read_admin on public.risk_scores
  for select using (public.is_admin());
