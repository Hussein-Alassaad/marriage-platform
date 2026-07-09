-- Finance module.
-- What: personal income/expenses/budgets/goals/wedding plans, shared (couple)
--       finance gated to the Married stage with dual consent, reports with
--       snapshotted rates, and an auto-updated exchange_rates table.
-- Why: amounts are stored in their original currency and converted on read
--      (LBP volatility). Admins are structurally blocked from personal finance —
--      there is no admin read policy here; only aggregate views (later) exist.

create table public.finance_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  primary_currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.income (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text,
  amount numeric(14, 2) not null,
  currency text not null default 'USD',
  recurring boolean not null default false,
  occurred_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index income_user_idx on public.income (user_id, occurred_on desc);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null,
  amount numeric(14, 2) not null,
  currency text not null default 'USD',
  recurring boolean not null default false,
  occurred_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index expenses_user_idx on public.expenses (user_id, occurred_on desc);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null,
  amount numeric(14, 2) not null,
  period text not null default 'monthly',
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  target_amount numeric(14, 2) not null,
  current_amount numeric(14, 2) not null default 0,
  currency text not null default 'USD',
  deadline date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wedding_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  categories jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Shared couple finance: requires both users in the Married Stage + dual consent
-- (enforced by the finance Edge Function). Termination auto-disconnects.
create table public.shared_finance (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  user_a_consent boolean not null default false,
  user_b_consent boolean not null default false,
  active boolean not null default false,
  activated_at timestamptz,
  disconnected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id)
);

create table public.financial_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  match_id uuid references public.matches (id) on delete cascade,
  period text not null,
  data jsonb not null default '{}',
  rate_snapshot jsonb not null default '{}', -- rates used, frozen for stable history
  created_at timestamptz not null default now()
);

create table public.exchange_rates (
  base_currency text not null,
  quote_currency text not null,
  rate numeric(18, 8) not null,
  as_of date not null default current_date,
  updated_at timestamptz not null default now(),
  primary key (base_currency, quote_currency, as_of)
);

-- updated_at triggers
create trigger finance_accounts_set_updated_at before update on public.finance_accounts for each row execute function public.set_updated_at();
create trigger income_set_updated_at before update on public.income for each row execute function public.set_updated_at();
create trigger expenses_set_updated_at before update on public.expenses for each row execute function public.set_updated_at();
create trigger budgets_set_updated_at before update on public.budgets for each row execute function public.set_updated_at();
create trigger savings_goals_set_updated_at before update on public.savings_goals for each row execute function public.set_updated_at();
create trigger wedding_plans_set_updated_at before update on public.wedding_plans for each row execute function public.set_updated_at();
create trigger shared_finance_set_updated_at before update on public.shared_finance for each row execute function public.set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.finance_accounts enable row level security;
alter table public.income enable row level security;
alter table public.expenses enable row level security;
alter table public.budgets enable row level security;
alter table public.savings_goals enable row level security;
alter table public.wedding_plans enable row level security;
alter table public.shared_finance enable row level security;
alter table public.financial_reports enable row level security;
alter table public.exchange_rates enable row level security;

-- Personal finance: owner-only, full CRUD. NO admin policy anywhere (privacy).
do $$
declare t text;
begin
  foreach t in array array['finance_accounts','income','expenses','budgets','savings_goals','wedding_plans'] loop
    execute format('create policy %1$s_rw_own on public.%1$s for all using (user_id = auth.uid()) with check (user_id = auth.uid());', t);
  end loop;
end $$;

-- Shared finance / reports: readable by match participants; writes via Edge Function.
create policy shared_finance_read_participant on public.shared_finance
  for select using (public.is_match_participant(match_id));

create policy financial_reports_read_own on public.financial_reports
  for select using (user_id = auth.uid() or (match_id is not null and public.is_match_participant(match_id)));

-- Exchange rates are public reference data (read-only for clients).
create policy exchange_rates_read_all on public.exchange_rates
  for select using (true);
