-- Subscriptions & payments (schema now; gateway/claim flows in Phase 9).
-- What: plan catalog, subscriptions, gateway payments, Lebanese manual payment
--       claims, coupons, and support tickets.
-- Why: one gateway-independent subscription surface. We never store card data —
--      only gateway references. Activation happens server-side; clients cannot
--      write subscriptions or payments.

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  tier public.subscription_tier not null unique,
  name text not null,
  monthly_price numeric(10, 2) not null default 0,
  yearly_price numeric(10, 2),
  currency text not null default 'USD',
  features jsonb not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tier public.subscription_tier not null default 'free',
  status text not null default 'active', -- active | expired | cancelled | grace
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  auto_renew boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_user_idx on public.subscriptions (user_id, status);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  method public.payment_method not null,
  amount numeric(10, 2) not null,
  currency text not null default 'USD',
  status public.payment_status not null default 'pending',
  gateway_ref text, -- provider reference only; NEVER card data
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_user_idx on public.payments (user_id, created_at desc);

create table public.payment_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  method public.payment_method not null, -- omt | whish | bank_transfer
  reference_code text not null unique default encode(extensions.gen_random_bytes(6), 'hex'),
  receipt_path text, -- path in the private payment-receipts bucket
  amount numeric(10, 2),
  currency text not null default 'USD',
  status public.payment_status not null default 'pending',
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index payment_claims_status_idx on public.payment_claims (status, created_at);

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null default 'percent', -- percent | fixed
  discount_value numeric(10, 2) not null,
  currency text,
  plan_restriction public.subscription_tier,
  expires_at timestamptz,
  usage_limit integer,
  used_count integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  category text not null default 'general', -- payment | technical | bug | feature | general
  subject text not null,
  body text,
  status text not null default 'open', -- open | in_progress | closed
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_tickets_status_idx on public.support_tickets (status, created_at desc);

create trigger subscription_plans_set_updated_at before update on public.subscription_plans for each row execute function public.set_updated_at();
create trigger subscriptions_set_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();
create trigger payments_set_updated_at before update on public.payments for each row execute function public.set_updated_at();
create trigger support_tickets_set_updated_at before update on public.support_tickets for each row execute function public.set_updated_at();

-- ── Seeds — plan catalog ────────────────────────────────────────────────────
insert into public.subscription_plans (tier, name, monthly_price, yearly_price, features) values
  ('free', 'Free Member', 0, 0, '{"photos": false, "shared_finance": false}'),
  ('serious', 'Serious Member', 14.99, 119, '{"photos": true, "charts": true, "advanced_filters": true}'),
  ('marriage_plus', 'Marriage Plus', 39.99, null, '{"unlimited_ai": true, "couple_finance": true, "priority": true}');

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.subscription_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.payment_claims enable row level security;
alter table public.coupons enable row level security;
alter table public.support_tickets enable row level security;

-- Plans are public (pricing page).
create policy subscription_plans_read_all on public.subscription_plans
  for select using (active = true or public.is_admin());

-- Subscriptions & payments: read own; no client writes (server activates).
create policy subscriptions_read_own on public.subscriptions
  for select using (user_id = auth.uid() or public.is_admin());
create policy payments_read_own on public.payments
  for select using (user_id = auth.uid() or public.is_admin());

-- Manual claims: user submits (insert own) and reads own; admins review.
create policy payment_claims_read_own on public.payment_claims
  for select using (user_id = auth.uid() or public.is_admin());
create policy payment_claims_insert_own on public.payment_claims
  for insert with check (user_id = auth.uid());

-- Coupons validated server-side; admin-only visibility.
create policy coupons_read_admin on public.coupons
  for select using (public.is_admin());

-- Support tickets: user reads/creates own; admins read all.
create policy support_tickets_read_own on public.support_tickets
  for select using (user_id = auth.uid() or public.is_admin());
create policy support_tickets_insert_own on public.support_tickets
  for insert with check (user_id = auth.uid());
