-- Daily match generation — the registry row from Phase 2, actually running.
--
-- Until now, compatibility_scores and daily_recommendations only refreshed when a
-- verified member opened Discover and clicked "Generate recommendations"
-- (compute-compatibility Edge Function). Nobody who doesn't click gets fresh
-- recommendations, ever. This migration moves the scoring formula into SQL, as a
-- single source of truth, then:
--   1. a nightly pg_cron job scores every verified member against the opposite
--      gender automatically (same pattern as the other jobs in
--      20260714160000_scheduled_jobs.sql — plain SQL, no Edge Function, no
--      service key);
--   2. compute-compatibility calls the same SQL function for the on-demand
--      button, so scheduled and manual runs can never disagree.
--
-- The formula itself (weights, ordinal scales, distance/communication rules) is
-- copied verbatim from supabase/functions/compute-compatibility/index.ts — no
-- behavior change, just one implementation instead of two.

-- ── Ordinal-scale comparison (mirrors SCALES + ordinal() in compute-compatibility) ──
create or replace function public.compat_ordinal(p_scale text, p_a text, p_b text)
returns integer
language plpgsql
immutable
as $$
declare
  scale text[];
  i int;
  j int;
begin
  if p_a is null or p_b is null then
    return 60;
  end if;

  scale := case p_scale
    when 'religiosity' then array['growing', 'moderate', 'practicing']
    when 'smoking'     then array['no', 'sometimes', 'yes']
    when 'involvement' then array['independent', 'moderate', 'high']
    when 'savings'     then array['early', 'building', 'ready']
    when 'timeline'    then array['exploring', 'one_two_years', 'within_year']
    when 'children'    then array['prefer_not', 'open', 'want']
    when 'relocate'    then array['stay', 'open', 'willing']
    else array[]::text[]
  end;

  i := array_position(scale, p_a);
  j := array_position(scale, p_b);
  if i is null or j is null then
    return case when p_a = p_b then 100 else 55 end;
  end if;

  return case abs(i - j) when 0 then 100 when 1 then 70 else 45 end;
end;
$$;

-- ── Score one member against every eligible candidate, upsert scores, rebuild
--    today's ranked recommendations. Returns 'ok: N' or 'skipped: <reason>' so
--    both the cron job and the Edge Function can tell what happened.
--
-- Idempotent: compatibility_scores is upserted on (user_id, candidate_id); today's
-- daily_recommendations rows are deleted and re-inserted, so re-running for the
-- same member on the same day just recomputes the same ranked list.
create or replace function public.compute_compatibility_for_user(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  me record;
  wanted public.gender;
  n integer;
begin
  select id, gender, country, city, languages, marriage_goals, lifestyle,
         family_values, financial_readiness, verification_status
  into me
  from public.profiles
  where id = p_user_id and deleted_at is null;

  if not found then
    return 'skipped: no_profile';
  end if;
  if me.verification_status <> 'verified' then
    return 'skipped: not_verified';
  end if;
  if me.gender is null then
    return 'skipped: incomplete_profile';
  end if;

  wanted := case me.gender when 'man' then 'woman'::public.gender else 'man'::public.gender end;

  drop table if exists compat_scratch;
  create temporary table compat_scratch as
  select *,
    round(
      religion * 0.2 + values_s * 0.12 + goals * 0.22 + lifestyle_s * 0.1 +
      distance * 0.1 + financial * 0.1 + communication * 0.1 + personality * 0.06
    )::smallint as overall
  from (
    select
      c.id as candidate_id,
      public.compat_ordinal('religiosity', me.lifestyle ->> 'religiosity', c.lifestyle ->> 'religiosity') as religion,
      public.compat_ordinal('involvement', me.family_values ->> 'involvement', c.family_values ->> 'involvement') as values_s,
      round((
        public.compat_ordinal('timeline', me.marriage_goals ->> 'timeline', c.marriage_goals ->> 'timeline') +
        public.compat_ordinal('children', me.marriage_goals ->> 'children', c.marriage_goals ->> 'children') +
        public.compat_ordinal('relocate', me.marriage_goals ->> 'relocate', c.marriage_goals ->> 'relocate')
      ) / 3.0)::smallint as goals,
      public.compat_ordinal('smoking', me.lifestyle ->> 'smoking', c.lifestyle ->> 'smoking') as lifestyle_s,
      (case
         when me.city is not null and c.city is not null and me.city = c.city then 100
         when me.country is not null and c.country is not null and me.country = c.country then 75
         when me.country is not null and c.country is not null then 45
         else 60
       end)::smallint as distance,
      public.compat_ordinal('savings', me.financial_readiness ->> 'savings', c.financial_readiness ->> 'savings') as financial,
      (case
         when coalesce(array_length(me.languages, 1), 0) > 0 and coalesce(array_length(c.languages, 1), 0) > 0 then
           case when me.languages && c.languages then 100 else 50 end
         else 60
       end)::smallint as communication,
      60::smallint as personality
    from public.profiles c
    where c.deleted_at is null
      and c.verification_status = 'verified'
      and c.gender = wanted
      and c.id <> me.id
      and c.id not in (select candidate_id from public.declined_profiles where user_id = me.id)
      and c.id not in (
        select case when user_a = me.id then user_b else user_a end
        from public.matches
        where deleted_at is null and (user_a = me.id or user_b = me.id)
      )
    limit 200
  ) sub;

  select count(*) into n from compat_scratch;
  if n = 0 then
    drop table if exists compat_scratch;
    return 'ok: 0';
  end if;

  insert into public.compatibility_scores (user_id, candidate_id, overall, breakdown, computed_at)
  select
    me.id,
    s.candidate_id,
    s.overall,
    jsonb_build_object(
      'religion', s.religion, 'values', s.values_s, 'goals', s.goals, 'lifestyle', s.lifestyle_s,
      'distance', s.distance, 'financial', s.financial, 'communication', s.communication,
      'personality', s.personality
    ),
    now()
  from compat_scratch s
  on conflict (user_id, candidate_id) do update
    set overall = excluded.overall, breakdown = excluded.breakdown, computed_at = excluded.computed_at;

  delete from public.daily_recommendations where user_id = me.id and rec_date = current_date;

  insert into public.daily_recommendations (user_id, candidate_id, rec_date, rank)
  select me.id, s.candidate_id, current_date, row_number() over (order by s.overall desc)
  from compat_scratch s
  order by s.overall desc
  limit 20;

  drop table if exists compat_scratch;
  return format('ok: %s', least(n, 20));
end;
$$;

-- ── Nightly batch: every verified member with a gender set ──────────────────
create or replace function public.job_generate_daily_matches()
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  u record;
  n integer := 0;
begin
  for u in
    select id from public.profiles
    where deleted_at is null and verification_status = 'verified' and gender is not null
  loop
    perform public.compute_compatibility_for_user(u.id);
    n := n + 1;
  end loop;
  return format('processed %s members', n);
end;
$$;

-- ── Wire it into run_job (recreated with the added branch) ──────────────────
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

-- ── Lock these down to service_role ──────────────────────────────────────────
-- New functions default to PUBLIC execute in Postgres. run_job() is already
-- reachable only through the admin Edge Function's service-role client, and
-- compute_compatibility_for_user(uuid) takes an arbitrary user id — left open it
-- would let any authenticated client force-write recommendations for someone
-- else's account. Only the service role (Edge Functions, pg_cron) may call any
-- of these; clients never should.
revoke execute on function public.compute_compatibility_for_user(uuid) from public, anon, authenticated;
grant execute on function public.compute_compatibility_for_user(uuid) to service_role;

revoke execute on function public.job_generate_daily_matches() from public, anon, authenticated;
grant execute on function public.job_generate_daily_matches() to service_role;

revoke execute on function public.run_job(text) from public, anon, authenticated;
grant execute on function public.run_job(text) to service_role;

-- ── Enable the registry row seeded (disabled) in Phase 2 ─────────────────────
update public.scheduled_jobs set enabled = true where name = 'daily_match_generation';

-- ── Schedule it (unschedule first — cron.schedule is idempotent on name in
--    recent pg_cron, but this makes re-running the migration safe regardless) ──
do $$
begin
  begin
    perform cron.unschedule('mithaq_daily_match_generation');
  exception when others then
    null; -- not scheduled yet; nothing to remove
  end;
  perform cron.schedule(
    'mithaq_daily_match_generation',
    (select schedule from public.scheduled_jobs where name = 'daily_match_generation'),
    'select public.run_job(''daily_match_generation'');'
  );
end $$;
