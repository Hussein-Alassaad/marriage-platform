-- Scheduled jobs — the registry from Phase 2, actually running.
--
-- Every job here is a SQL function called by pg_cron. No Edge Function, no service key,
-- no HTTP hop: a job that needs a secret to run is a job that silently stops running the
-- day the secret rotates. The one job that must reach the outside world (exchange rates)
-- uses pg_net against a **keyless** public API.
--
-- Every job is IDEMPOTENT. That is the whole discipline of this file: cron double-fires,
-- a deploy replays, an admin clicks "run now" — none of that may produce a duplicate
-- notification, a double downgrade, or a deleted document that was still needed. Each
-- job below states how it stays idempotent.
--
-- `run_job(name)` is the only entry point. It checks the registry's `enabled` flag,
-- records `last_run_at` / `last_result`, and swallows nothing — a failing job records its
-- error so the admin dashboard can show a job that has been quietly dying.

-- ── Where a two-step HTTP job keeps its request id ───────────────────────────
create table public.job_requests (
  job text primary key,
  request_id bigint not null,
  requested_at timestamptz not null default now()
);
alter table public.job_requests enable row level security; -- no policies: service role only

-- ── 1. Held notifications (quiet hours / digest) ─────────────────────────────
-- Idempotent: `deliver_notification_event` only acts on events with processed_at null,
-- and sets it. A second run finds nothing to do.
create or replace function public.job_flush_notifications()
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  e public.notification_events%rowtype;
  prefs public.notification_preferences%rowtype;
  delivered integer := 0;
  digest_hour constant integer := 8; -- local hour the digest goes out
  local_hour integer;
  ready boolean;
begin
  for e in
    select * from public.notification_events
    where processed_at is null and user_id is not null
    order by created_at
    limit 500
  loop
    select * into prefs from public.notification_preferences where user_id = e.user_id;

    -- Still inside quiet hours: leave it held. This is the whole point of holding.
    if public.in_quiet_hours(prefs.quiet_hours, now()) then
      continue;
    end if;

    ready := true;
    if coalesce(prefs.digest_mode, 'immediate') in ('daily', 'weekly') then
      local_hour := extract(hour from (now() at time zone coalesce(prefs.quiet_hours ->> 'tz', 'UTC')))::integer;
      ready := local_hour = digest_hour;
      if prefs.digest_mode = 'weekly' then
        ready := ready and extract(isodow from now())::integer = 1; -- Monday
      end if;
    end if;

    if ready and public.deliver_notification_event(e.id, true) then
      delivered := delivered + 1;
    end if;
  end loop;

  return format('delivered %s', delivered);
end;
$$;

-- ── 2. Expired payment claims ────────────────────────────────────────────────
-- Idempotent: only `pending` rows are touched, and they leave as `expired`.
create or replace function public.job_expire_payment_claims()
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  n integer;
begin
  update public.payment_claims
  set status = 'expired'
  where status = 'pending' and expires_at is not null and expires_at < now();
  get diagnostics n = row_count;
  return format('expired %s claims', n);
end;
$$;

-- ── 3. Subscription expiry reminders (7 / 3 / 1 days) ────────────────────────
-- Idempotent: an event is emitted only if no `subscription.expiring` event already
-- exists for that user with that day count. Re-running the job the same day is a no-op.
create or replace function public.job_subscription_reminders()
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  s record;
  days_left integer;
  sent integer := 0;
begin
  for s in
    select user_id, expires_at
    from public.subscriptions
    where status = 'active'
      and expires_at is not null
      and expires_at between now() and now() + interval '7 days'
  loop
    days_left := ceil(extract(epoch from (s.expires_at - now())) / 86400)::integer;
    if days_left not in (1, 3, 7) then
      continue;
    end if;

    if exists (
      select 1 from public.notification_events
      where user_id = s.user_id
        and event_type = 'subscription.expiring'
        and (payload ->> 'daysLeft')::integer = days_left
        and created_at > now() - interval '30 days'
    ) then
      continue; -- already told them at this milestone
    end if;

    insert into public.notification_events (event_type, user_id, payload)
    values ('subscription.expiring', s.user_id, jsonb_build_object('daysLeft', days_left));
    sent := sent + 1;
  end loop;

  return format('reminded %s members', sent);
end;
$$;

-- ── 4. Expire subscriptions and downgrade ────────────────────────────────────
-- Idempotent: only `active` rows past their expiry are touched, and they become
-- `expired`. The tier reset is a plain assignment to 'free', which is safe to repeat.
create or replace function public.job_expire_subscriptions()
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  s record;
  n integer := 0;
begin
  for s in
    select id, user_id from public.subscriptions
    where status = 'active' and expires_at is not null and expires_at < now()
  loop
    update public.subscriptions set status = 'expired' where id = s.id;

    -- Downgrade only if they have no OTHER active subscription (an early renewal
    -- creates a second row — expiring the old one must not strip the new tier).
    if not exists (
      select 1 from public.subscriptions
      where user_id = s.user_id and status = 'active' and (expires_at is null or expires_at > now())
    ) then
      update public.profiles set subscription_tier = 'free' where id = s.user_id;
      insert into public.notification_events (event_type, user_id, payload)
      values ('subscription.expired', s.user_id, '{}'::jsonb);

      -- Losing the tier disconnects Couple Finance: it requires BOTH sides to hold it.
      update public.shared_finance sf
      set active = false, user_a_consent = false, user_b_consent = false, disconnected_at = now()
      from public.matches m
      where sf.match_id = m.id
        and sf.active
        and (m.user_a = s.user_id or m.user_b = s.user_id);
    end if;

    n := n + 1;
  end loop;

  return format('expired %s subscriptions', n);
end;
$$;

-- ── 5. Identity document cleanup (Decision #15) ──────────────────────────────
-- "Identity documents should be deleted after successful verification." Until now that
-- was a manual promise; this makes it automatic. Only VERIFIED records are cleaned (a
-- pending or rejected one still needs its document), and only after a grace period so an
-- appeal is still possible.
--
-- Idempotent: it nulls the paths as it deletes, so a second run finds no rows.
create or replace function public.job_cleanup_identity_documents()
returns text
language plpgsql
security definer
set search_path = public, pg_catalog, storage
as $$
declare
  v record;
  grace_days integer;
  n integer := 0;
begin
  select coalesce((value)::text::integer, 30) into grace_days
  from public.settings where key = 'identity_document_retention_days';
  grace_days := coalesce(grace_days, 30);

  for v in
    select id, user_id, document_path, selfie_path
    from public.identity_verifications
    where status = 'verified' -- the enum's success value; there is no 'approved'
      and reviewed_at is not null
      and reviewed_at < now() - make_interval(days => grace_days)
      and (document_path is not null or selfie_path is not null)
  loop
    delete from storage.objects
    where bucket_id = 'identity-documents'
      and name in (v.document_path, v.selfie_path);

    update public.identity_verifications
    set document_path = null, selfie_path = null
    where id = v.id;

    insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
    values (null, 'verification.documents_deleted', 'identity_verification', v.id,
            jsonb_build_object('user_id', v.user_id, 'retention_days', grace_days));

    n := n + 1;
  end loop;

  return format('cleaned %s verifications', n);
end;
$$;

-- ── 6. Exchange rates, in two steps (pg_net is asynchronous) ─────────────────
-- Step one fires the request; step two, five minutes later, reads the reply. Splitting it
-- is not a workaround — it is how pg_net works, and pretending otherwise would give us a
-- job that always sees an empty response.
--
-- The API is keyless on purpose (open.er-api.com). A finance module whose rates stop
-- updating the day an API key expires is worse than one that uses a free source.
--
-- Idempotent + safe: rates are upserted per (base, quote, as_of). If the fetch fails, the
-- previous rates simply stay — the job NEVER writes a rate it did not receive, because a
-- silently wrong exchange rate corrupts every figure on the finance page.
create or replace function public.job_fetch_exchange_rates()
returns text
language plpgsql
security definer
set search_path = public, pg_catalog, net, extensions
as $$
declare
  req_id bigint;
begin
  select net.http_get('https://open.er-api.com/v6/latest/USD') into req_id;
  insert into public.job_requests (job, request_id, requested_at)
  values ('exchange_rates', req_id, now())
  on conflict (job) do update set request_id = excluded.request_id, requested_at = now();
  return format('requested (%s)', req_id);
end;
$$;

create or replace function public.job_collect_exchange_rates()
returns text
language plpgsql
security definer
set search_path = public, pg_catalog, net, extensions
as $$
declare
  req record;
  resp record;
  body jsonb;
  rates jsonb;
  wanted text[];
  code text;
  n integer := 0;
begin
  select * into req from public.job_requests where job = 'exchange_rates';
  if not found then
    return 'no request pending';
  end if;

  select status_code, content into resp
  from net._http_response where id = req.request_id;
  if not found then
    return 'response not ready';
  end if;
  if resp.status_code <> 200 then
    return format('http %s — keeping previous rates', resp.status_code);
  end if;

  body := resp.content::jsonb;
  rates := body -> 'rates';
  if rates is null then
    return 'malformed response — keeping previous rates';
  end if;

  -- Only the currencies the platform actually offers.
  select array(select jsonb_array_elements_text(value)) into wanted
  from public.settings where key = 'finance_currencies';
  if wanted is null then
    wanted := array['USD'];
  end if;

  foreach code in array wanted loop
    if rates ? code then
      insert into public.exchange_rates (base_currency, quote_currency, rate, as_of)
      values ('USD', code, (rates ->> code)::numeric, current_date)
      on conflict (base_currency, quote_currency, as_of)
      do update set rate = excluded.rate, updated_at = now();
      n := n + 1;
    end if;
  end loop;

  delete from public.job_requests where job = 'exchange_rates';
  return format('updated %s rates', n);
end;
$$;

-- ── The single entry point ───────────────────────────────────────────────────
-- Checks the registry flag, runs the job, records the outcome. A job that throws records
-- its error instead of vanishing — an admin must be able to see a job that has been
-- quietly failing for a week.
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

-- ── Registry ─────────────────────────────────────────────────────────────────
insert into public.scheduled_jobs (name, schedule, enabled) values
  ('notification_flush',     '*/15 * * * *', true),
  ('subscription_reminders', '0 9 * * *',    true),
  ('expire_subscriptions',   '0 1 * * *',    true),
  ('exchange_rates_fetch',   '0 6 * * *',    true),
  ('exchange_rates_collect', '5 6 * * *',    true)
on conflict (name) do nothing;

-- These two were seeded in Phase 2 and are now implemented, so switch them on.
update public.scheduled_jobs set enabled = true, schedule = '0 4 * * *' where name = 'expired_payment_claims';
update public.scheduled_jobs set enabled = true, schedule = '0 5 * * *' where name = 'document_cleanup';

-- Deliberately still disabled — each needs a funded AI key or Phase 14's analytics
-- tables. Leaving them registered-but-off is honest; deleting them would hide the gap.
--   daily_match_generation, monthly_finance_reports, analytics_rollup,
--   notification_digests (folded into notification_flush)
-- `conversation_summaries` is not in that list: it was DROPPED from the product
-- (see 20260714190000), not left for later.

insert into public.settings (key, value, type, is_public, description) values
  ('identity_document_retention_days', '30', 'number', false,
   'Days after approval before identity documents are deleted (Decision #15)')
on conflict (key) do nothing;

-- ── Schedules ────────────────────────────────────────────────────────────────
-- `cron.schedule` is idempotent on the job name in recent pg_cron; unschedule first so
-- re-running this migration cannot leave two copies of the same job firing.
do $$
declare
  j record;
begin
  for j in
    select * from (values
      ('mithaq_notification_flush',     '*/15 * * * *', 'notification_flush'),
      ('mithaq_expired_claims',         '0 4 * * *',    'expired_payment_claims'),
      ('mithaq_subscription_reminders', '0 9 * * *',    'subscription_reminders'),
      ('mithaq_expire_subscriptions',   '0 1 * * *',    'expire_subscriptions'),
      ('mithaq_document_cleanup',       '0 5 * * *',    'document_cleanup'),
      ('mithaq_rates_fetch',            '0 6 * * *',    'exchange_rates_fetch'),
      ('mithaq_rates_collect',          '5 6 * * *',    'exchange_rates_collect')
    ) as t(cron_name, schedule, job_name)
  loop
    begin
      perform cron.unschedule(j.cron_name);
    exception when others then
      null; -- not scheduled yet; nothing to remove
    end;
    perform cron.schedule(j.cron_name, j.schedule, format('select public.run_job(%L);', j.job_name));
  end loop;
end $$;
