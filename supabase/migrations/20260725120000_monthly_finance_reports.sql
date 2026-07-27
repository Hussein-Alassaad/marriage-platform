-- Monthly finance reports — the registry row from Phase 2, actually running.
--
-- Serious+ members already see live charts/budgets/goals; nothing ever froze a month
-- into something they could look back on, and "reports" is a line item the free-tier
-- upgrade card has always promised (FinancePage.tsx UpgradeCard) without anything behind
-- it. This closes that gap: on the 1st of each month, one row per eligible member lands
-- in `financial_reports` (seeded, unused, since Phase 2) — last month's income/expenses/
-- net in their display currency, spend by category, budget-vs-actual, savings-goal
-- progress, and the prior month's totals for a trend line.
--
-- Currency conversion is resolved and frozen at generation time (`rate_snapshot`), per
-- Decision #14 — a report must read the same way in six months even after the LBP moves.
-- An amount whose currency has no rate is counted in `unconvertible`, never silently
-- dropped, mirroring `sumIn()` in src/utils/money.ts.
--
-- The `narrative` field starts null. Writing the AI paragraph needs ANTHROPIC_API_KEY,
-- which this SQL job cannot hold (no Edge Function, no service key, no HTTP hop — see
-- 20260714160000_scheduled_jobs.sql) — so a member opening a report for the first time
-- triggers it on demand via the `finance` Edge Function's new `report-narrative` action,
-- which caches the result back onto the row. The report itself is never blocked on the key
-- existing; it degrades to numbers-only, same pattern as suggest-questions.

-- ── Idempotency for personal (non-joint) reports: one row per member per period ──
create unique index if not exists financial_reports_user_period_idx
  on public.financial_reports (user_id, period) where match_id is null;

alter table public.financial_reports
  add column if not exists updated_at timestamptz not null default now();
-- RLS + the anon/authenticated write revoke are already in place from
-- 20260709120700_finance.sql and 20260714140000_shared_finance_guard.sql.

-- ── Generate (or skip) one member's report for one period ('YYYY-MM') ───────────
-- Returns 'ok', or 'skipped: <reason>' so both the cron job and the Edge Function
-- (which calls this for a one-off "regenerate" action later, if ever needed) can tell
-- what happened. Idempotent: a report already on file for the period is left alone —
-- re-running the job the same month recomputes nothing and notifies nobody twice.
create or replace function public.generate_monthly_report_for_user(p_user_id uuid, p_period text)
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  tier public.subscription_tier;
  min_tier text;
  display_ccy text;
  period_start date;
  period_end date;
  prev_start date;
  prev_end date;
  rates jsonb;
  income_total numeric := 0;
  expense_total numeric := 0;
  income_unconvertible int := 0;
  expense_unconvertible int := 0;
  prev_income numeric := 0;
  prev_expense numeric := 0;
  by_category jsonb;
  budgets_json jsonb;
  goals_json jsonb;
  has_activity boolean;
  report_id uuid;
begin
  select subscription_tier into tier from public.profiles where id = p_user_id and deleted_at is null;
  if tier is null then
    return 'skipped: no_profile';
  end if;

  if exists (
    select 1 from public.financial_reports
    where user_id = p_user_id and period = p_period and match_id is null
  ) then
    return 'skipped: already_generated';
  end if;

  select coalesce(value #>> '{}', 'serious') into min_tier
  from public.settings where key = 'finance_charts_min_tier';
  min_tier := coalesce(min_tier, 'serious');

  if array_position(array['free', 'serious', 'marriage_plus'], tier::text)
     < array_position(array['free', 'serious', 'marriage_plus'], min_tier) then
    return 'skipped: tier_too_low';
  end if;

  period_start := to_date(p_period || '-01', 'YYYY-MM-DD');
  period_end := (period_start + interval '1 month')::date;
  prev_start := (period_start - interval '1 month')::date;
  prev_end := period_start;

  select exists (
    select 1 from public.income
    where user_id = p_user_id and occurred_on >= period_start and occurred_on < period_end
    union all
    select 1 from public.expenses
    where user_id = p_user_id and occurred_on >= period_start and occurred_on < period_end
  ) into has_activity;
  if not has_activity then
    return 'skipped: no_activity';
  end if;

  select coalesce(primary_currency, 'USD') into display_ccy
  from public.finance_accounts where user_id = p_user_id;
  display_ccy := coalesce(display_ccy, 'USD');

  -- Latest known rate per currency — mirrors toRateMap() in src/utils/money.ts (newest
  -- as_of wins per quote currency). Frozen into rate_snapshot below.
  select jsonb_object_agg(quote_currency, rate) into rates
  from (
    select distinct on (quote_currency) quote_currency, rate
    from public.exchange_rates
    where base_currency = 'USD'
    order by quote_currency, as_of desc
  ) r;
  rates := coalesce(rates, '{}'::jsonb) || jsonb_build_object('USD', 1);

  -- ── This period's income/expense totals, converted via USD (Decision #14) ──
  with conv as (
    select amount,
      case
        when currency = display_ccy then amount
        when rates ? currency and rates ? display_ccy
          then (amount / (rates ->> currency)::numeric) * (rates ->> display_ccy)::numeric
        else null
      end as converted
    from public.income
    where user_id = p_user_id and occurred_on >= period_start and occurred_on < period_end
  )
  select coalesce(sum(converted), 0), count(*) filter (where converted is null)
  into income_total, income_unconvertible
  from conv;

  with conv as (
    select amount,
      case
        when currency = display_ccy then amount
        when rates ? currency and rates ? display_ccy
          then (amount / (rates ->> currency)::numeric) * (rates ->> display_ccy)::numeric
        else null
      end as converted
    from public.expenses
    where user_id = p_user_id and occurred_on >= period_start and occurred_on < period_end
  )
  select coalesce(sum(converted), 0), count(*) filter (where converted is null)
  into expense_total, expense_unconvertible
  from conv;

  select jsonb_agg(jsonb_build_object('category', category, 'amount', round(total, 2)) order by total desc)
  into by_category
  from (
    select category, sum(
      case
        when currency = display_ccy then amount
        when rates ? currency and rates ? display_ccy
          then (amount / (rates ->> currency)::numeric) * (rates ->> display_ccy)::numeric
        else 0
      end
    ) as total
    from public.expenses
    where user_id = p_user_id and occurred_on >= period_start and occurred_on < period_end
    group by category
  ) c;

  -- ── Previous period, for the trend line (best-effort; unconvertible entries drop out) ──
  with conv as (
    select amount,
      case
        when currency = display_ccy then amount
        when rates ? currency and rates ? display_ccy
          then (amount / (rates ->> currency)::numeric) * (rates ->> display_ccy)::numeric
        else null
      end as converted
    from public.income where user_id = p_user_id and occurred_on >= prev_start and occurred_on < prev_end
  )
  select coalesce(sum(converted), 0) into prev_income from conv;

  with conv as (
    select amount,
      case
        when currency = display_ccy then amount
        when rates ? currency and rates ? display_ccy
          then (amount / (rates ->> currency)::numeric) * (rates ->> display_ccy)::numeric
        else null
      end as converted
    from public.expenses where user_id = p_user_id and occurred_on >= prev_start and occurred_on < prev_end
  )
  select coalesce(sum(converted), 0) into prev_expense from conv;

  -- ── Budgets: monthly budgets vs. this period's spend, same currency only (a budget
  --    set in a different currency than an expense category isn't comparable without
  --    guessing an exchange rate for a category total, so it is left out rather than
  --    silently converted) ──
  select jsonb_agg(jsonb_build_object(
    'category', b.category, 'budgeted', b.amount, 'currency', b.currency,
    'spent', coalesce(sp.spent, 0), 'overBudget', coalesce(sp.spent, 0) > b.amount
  ))
  into budgets_json
  from public.budgets b
  left join (
    select category, currency, sum(amount) as spent
    from public.expenses
    where user_id = p_user_id and occurred_on >= period_start and occurred_on < period_end
    group by category, currency
  ) sp on sp.category = b.category and sp.currency = b.currency
  where b.user_id = p_user_id and b.period = 'monthly';

  -- ── Goals: current standing, not period-scoped ──
  select jsonb_agg(jsonb_build_object(
    'name', name, 'target', target_amount, 'current', current_amount, 'currency', currency,
    'progressPct', case when target_amount > 0
      then round(least(current_amount / target_amount, 1) * 100) else 0 end
  ))
  into goals_json
  from public.savings_goals
  where user_id = p_user_id;

  insert into public.financial_reports (user_id, match_id, period, data, rate_snapshot, updated_at)
  values (
    p_user_id, null, p_period,
    jsonb_build_object(
      'currency', display_ccy,
      'income', round(income_total, 2),
      'expenses', round(expense_total, 2),
      'net', round(income_total - expense_total, 2),
      'unconvertible', income_unconvertible + expense_unconvertible,
      'byCategory', coalesce(by_category, '[]'::jsonb),
      'budgets', coalesce(budgets_json, '[]'::jsonb),
      'goals', coalesce(goals_json, '[]'::jsonb),
      'previous', jsonb_build_object(
        'income', round(prev_income, 2), 'expenses', round(prev_expense, 2),
        'net', round(prev_income - prev_expense, 2)
      ),
      'narrative', null
    ),
    rates,
    now()
  )
  on conflict (user_id, period) where match_id is null do nothing
  returning id into report_id;

  if report_id is null then
    return 'skipped: race'; -- another run just beat us to it
  end if;

  insert into public.notification_events (event_type, user_id, payload)
  values ('finance.report_ready', p_user_id, jsonb_build_object('period', p_period, 'reportId', report_id));

  return 'ok';
end;
$$;

-- ── Nightly-registry batch: every member, last calendar month ────────────────────
-- Scheduled for the 1st (see registry row from Phase 2), so "last month" is always
-- the month that just closed. Ineligible/inactive members are skipped cheaply inside
-- generate_monthly_report_for_user — no need to pre-filter by tier here.
create or replace function public.job_generate_monthly_reports()
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  u record;
  period text := to_char(current_date - interval '1 month', 'YYYY-MM');
  checked integer := 0;
  made integer := 0;
begin
  for u in select id from public.profiles where deleted_at is null loop
    checked := checked + 1;
    if public.generate_monthly_report_for_user(u.id, period) = 'ok' then
      made := made + 1;
    end if;
  end loop;
  return format('%s reports generated (%s members checked) for %s', made, checked, period);
end;
$$;

-- ── Wire it into run_job (recreated with the added branch) ──────────────────────
create or replace function public.run_job(job_name text)
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  job public.scheduled_jobs%rowtype;
  result text;
begin
  select * into job from public.scheduled_jobs where name = job_name;
  if not found then
    return 'unknown job';
  end if;
  if not job.enabled then
    return 'disabled';
  end if;

  begin
    result := case job_name
      when 'notification_flush'      then public.job_flush_notifications()
      when 'expired_payment_claims'  then public.job_expire_payment_claims()
      when 'subscription_reminders'  then public.job_subscription_reminders()
      when 'expire_subscriptions'    then public.job_expire_subscriptions()
      when 'document_cleanup'        then public.job_cleanup_identity_documents()
      when 'exchange_rates_fetch'    then public.job_fetch_exchange_rates()
      when 'exchange_rates_collect'  then public.job_collect_exchange_rates()
      when 'daily_match_generation'  then public.job_generate_daily_matches()
      when 'monthly_finance_reports' then public.job_generate_monthly_reports()
      else 'not implemented'
    end;
  exception when others then
    update public.scheduled_jobs
    set last_run_at = now(), last_result = 'error: ' || sqlerrm
    where name = job_name;
    return 'error: ' || sqlerrm;
  end;

  update public.scheduled_jobs set last_run_at = now(), last_result = result where name = job_name;
  return result;
end;
$$;

-- ── Lock the new functions to service_role, same reasoning as the daily-match job:
--    generate_monthly_report_for_user(uuid, text) takes an arbitrary user id, and
--    PUBLIC gets EXECUTE by default in Postgres unless revoked. ──
revoke execute on function public.generate_monthly_report_for_user(uuid, text) from public, anon, authenticated;
grant execute on function public.generate_monthly_report_for_user(uuid, text) to service_role;

revoke execute on function public.job_generate_monthly_reports() from public, anon, authenticated;
grant execute on function public.job_generate_monthly_reports() to service_role;

-- ── Enable the registry row seeded (disabled) in Phase 2 ─────────────────────────
update public.scheduled_jobs set enabled = true where name = 'monthly_finance_reports';

-- ── Schedule it ────────────────────────────────────────────────────────────────
do $$
begin
  begin
    perform cron.unschedule('mithaq_monthly_finance_reports');
  exception when others then
    null; -- not scheduled yet; nothing to remove
  end;
  perform cron.schedule(
    'mithaq_monthly_finance_reports',
    (select schedule from public.scheduled_jobs where name = 'monthly_finance_reports'),
    'select public.run_job(''monthly_finance_reports'');'
  );
end $$;

-- ── Notification copy (client renders via i18n; this is the pre-Phase-13 email fallback) ──
insert into public.notification_templates (type, locale, title, body) values
  ('finance.report_ready', 'en', 'Your monthly report is ready', 'Last month''s income, spending and goal progress are ready to view.')
on conflict (type, locale) do nothing;
