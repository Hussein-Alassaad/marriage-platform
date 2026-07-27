-- "Most Used Filters" (PRD Match Analytics) — a small event log so Admin →
-- Analytics can show which Discover search filters (Serious+, wired earlier in
-- 20260726110000_tiered_recommendations.sql's sibling matchmaking changes) actually
-- get used. Service-role-only, like `job_requests` — clients never read or write
-- this directly; `matchmaking` logs a row whenever `discover` is called with a
-- filter applied, and the `admin` analytics action aggregates it.
create table public.filter_usage_events (
  id uuid primary key default gen_random_uuid(),
  filter_key text not null,
  created_at timestamptz not null default now()
);
create index filter_usage_events_created_idx on public.filter_usage_events (created_at desc);

alter table public.filter_usage_events enable row level security; -- no policies: service role only
