-- Audit logs & background-job registry.
-- What: an immutable admin audit trail (before/after) and a registry of
--       scheduled jobs admins can see/toggle.
-- Why: the PRD requires immutable audit logs; append-only enforcement protects
--       admins and users alike. pg_cron itself is enabled in Phase 13 when the
--       jobs are wired — the registry table exists now so the schema is stable.

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  before jsonb,
  after jsonb,
  reason text,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);

-- Append-only: no updates or deletes, ever.
create trigger audit_logs_immutable
  before update or delete on public.audit_logs
  for each row execute function public.prevent_mutation();

create table public.scheduled_jobs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  schedule text not null, -- cron expression (registered with pg_cron in Phase 13)
  enabled boolean not null default true,
  last_run_at timestamptz,
  last_result text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger scheduled_jobs_set_updated_at before update on public.scheduled_jobs for each row execute function public.set_updated_at();

-- ── Seeds — the initial job registry (disabled until Phase 13 wires pg_cron) ──
insert into public.scheduled_jobs (name, schedule, enabled) values
  ('daily_match_generation', '0 2 * * *', false),
  ('conversation_summaries', '0 * * * *', false),
  ('reminders', '0 9 * * *', false),
  ('monthly_finance_reports', '0 3 1 * *', false),
  ('analytics_rollup', '0 * * * *', false),
  ('expired_payment_claims', '0 4 * * *', false),
  ('document_cleanup', '0 5 * * *', false),
  ('notification_digests', '0 8 * * *', false),
  ('exchange_rates_refresh', '0 6 * * *', false);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.audit_logs enable row level security;
alter table public.scheduled_jobs enable row level security;

create policy audit_logs_read_admin on public.audit_logs
  for select using (public.is_admin());

create policy scheduled_jobs_read_admin on public.scheduled_jobs
  for select using (public.is_admin());
