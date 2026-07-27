-- Marriage Plus Couple Finance: shared budgets + shared goals.
--
-- Found while building monthly reports: `finance_shared_min_tier` (seeded Phase 12,
-- value 'marriage_plus') was never read anywhere — Serious and Marriage Plus were
-- functionally identical in Finance, because the only Couple Finance feature that
-- existed (shared MONTHLY TOTALS, `shared-summary`) is gated at `basic_shared_finance_tier`
-- (default 'serious'). This migration gives Marriage Plus something real on top of
-- what Serious already gets: a genuine JOINT household budget and JOINT savings goal,
-- gated at `finance_shared_min_tier`.
--
-- Same trust model as `shared_finance`: crosses two users, so it is Edge-Function-only
-- (`finance`) — clients never write these tables directly, only read their own match's
-- rows, and only while shared_finance is active. Disconnecting Couple Finance hides
-- them immediately (the read policy checks shared_finance.active), same as shared-summary
-- already does for monthly totals.
--
-- What "shared" means here, deliberately narrow like the totals: a shared BUDGET compares
-- a joint target against the SUM of both spouses' spending in that category (never either
-- person's individual entries); a shared GOAL is a joint running balance either spouse can
-- contribute to (like a shared jar, not a ledger of who put in what).

create table public.shared_budgets (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  category text not null,
  amount numeric(14, 2) not null,
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, category)
);

create table public.shared_goals (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  name text not null,
  target_amount numeric(14, 2) not null,
  current_amount numeric(14, 2) not null default 0,
  currency text not null default 'USD',
  deadline date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger shared_budgets_set_updated_at before update on public.shared_budgets for each row execute function public.set_updated_at();
create trigger shared_goals_set_updated_at before update on public.shared_goals for each row execute function public.set_updated_at();

alter table public.shared_budgets enable row level security;
alter table public.shared_goals enable row level security;

-- Visible to either spouse only while the connection is active — a disconnect (either
-- side, no counter-signature, same as shared_finance) hides these immediately, same as
-- shared-summary already does for monthly totals.
create policy shared_budgets_read_participant on public.shared_budgets
  for select using (
    public.is_match_participant(match_id)
    and exists (select 1 from public.shared_finance sf where sf.match_id = shared_budgets.match_id and sf.active)
  );

create policy shared_goals_read_participant on public.shared_goals
  for select using (
    public.is_match_participant(match_id)
    and exists (select 1 from public.shared_finance sf where sf.match_id = shared_goals.match_id and sf.active)
  );

-- Edge-Function-only writes, same reasoning as shared_finance/financial_reports:
-- a client write path here would let one spouse plant or edit joint figures without
-- the tier + active-connection checks the Edge Function enforces.
revoke insert, update, delete on public.shared_budgets from anon, authenticated;
revoke insert, update, delete on public.shared_goals from anon, authenticated;

-- `finance_shared_min_tier` (seeded Phase 12, 'marriage_plus') is the setting this
-- feature was always meant to gate — it just had nothing wired to it. Reusing it
-- rather than adding a second, parallel setting for the same idea.
update public.settings
set description = 'Minimum tier BOTH spouses must hold for shared budgets/goals, on top of shared monthly totals which unlock at basic_shared_finance_tier (Decision #17). The Married Stage is required regardless.'
where key = 'finance_shared_min_tier';
