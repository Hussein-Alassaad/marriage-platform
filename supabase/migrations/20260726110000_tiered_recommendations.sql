-- Tiered daily recommendation limits + Marriage Plus refresh — finally reading the
-- settings that were seeded for this in Phase 2 and never wired up.
--
-- Found in the same audit that surfaced the Marriage Plus finance gap:
-- `daily_recs_free`/`daily_recs_serious`/`daily_recs_marriage_plus` and
-- `plus_refresh_per_day` all existed since Phase 2, described in their own text as
-- "New AI recommendations per day" per tier — but `compute_compatibility_for_user`
-- hardcoded `limit 20` regardless of tier, and there was no refresh mechanism at all.
--
-- What changes:
--   1. compute_compatibility_for_user now looks up the caller's tier and uses the
--      matching daily_recs_* setting instead of a hardcoded 20.
--   2. Every serve is logged to `served_recommendations` (seeded, unused, since
--      Phase 2) — first_served_at / times_served per candidate.
--   3. A NEW refresh_recommendations_for_user: Marriage Plus only, rate-limited by
--      plus_refresh_per_day, and — the actual point of "refresh" — EXCLUDES anyone
--      already in served_recommendations, so it surfaces genuinely different
--      profiles instead of recomputing the same top N.
--
-- Scope note: this does not implement the fuller "no-repeat unless persistently
-- strongest" design the Roadmap describes for the nightly job itself — that is a
-- bigger, separate feature (recommendation history + no-repeat-with-exceptions).
-- This closes the specific gap found: tier counts were ignored, and Marriage Plus
-- had nothing to actually refresh.

create table public.recommendation_refresh_counters (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default current_date,
  count integer not null default 0,
  primary key (user_id, day)
);
alter table public.recommendation_refresh_counters enable row level security;
create policy recommendation_refresh_counters_read_own on public.recommendation_refresh_counters
  for select using (user_id = auth.uid());
revoke insert, update, delete on public.recommendation_refresh_counters from anon, authenticated;

-- The old single-argument signature is replaced by a two-argument one below;
-- CREATE OR REPLACE cannot change a function's argument list, so the old one must
-- be dropped explicitly or it would keep existing (and keep being reachable)
-- alongside the new one.
drop function if exists public.compute_compatibility_for_user(uuid);

create or replace function public.compute_compatibility_for_user(
  p_user_id uuid,
  p_exclude_served boolean default false
)
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  me record;
  wanted public.gender;
  rec_limit integer;
  n integer;
begin
  select id, gender, country, city, languages, marriage_goals, lifestyle,
         family_values, financial_readiness, verification_status, subscription_tier
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

  select coalesce((
    (select value #>> '{}' from public.settings where key = case me.subscription_tier
      when 'marriage_plus' then 'daily_recs_marriage_plus'
      when 'serious' then 'daily_recs_serious'
      else 'daily_recs_free'
    end)
  )::integer, 20) into rec_limit;

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
      and (
        not p_exclude_served
        or c.id not in (select candidate_id from public.served_recommendations where user_id = me.id)
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
  limit rec_limit;

  -- Log every serve so a future refresh (or the fuller no-repeat design later) knows
  -- who has already been shown.
  insert into public.served_recommendations (user_id, candidate_id, first_served_at, times_served)
  select me.id, s.candidate_id, now(), 1
  from compat_scratch s
  order by s.overall desc
  limit rec_limit
  on conflict (user_id, candidate_id) do update
    set times_served = public.served_recommendations.times_served + 1;

  drop table if exists compat_scratch;
  return format('ok: %s', least(n, rec_limit));
end;
$$;

-- ── Marriage Plus: on-demand refresh, rate-limited, genuinely different profiles ──
create or replace function public.refresh_recommendations_for_user(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  tier public.subscription_tier;
  refresh_limit integer;
  used_today integer;
  result text;
begin
  select subscription_tier into tier from public.profiles where id = p_user_id and deleted_at is null;
  if tier is null then
    return 'skipped: no_profile';
  end if;
  if tier <> 'marriage_plus' then
    return 'skipped: tier_required';
  end if;

  select coalesce((select value #>> '{}' from public.settings where key = 'plus_refresh_per_day')::integer, 3)
  into refresh_limit;

  insert into public.recommendation_refresh_counters (user_id, day, count)
  values (p_user_id, current_date, 0)
  on conflict (user_id, day) do nothing;

  select count into used_today
  from public.recommendation_refresh_counters
  where user_id = p_user_id and day = current_date
  for update;

  if used_today >= refresh_limit then
    return format('skipped: refresh_limit_reached (%s/%s)', used_today, refresh_limit);
  end if;

  result := public.compute_compatibility_for_user(p_user_id, true);
  if result like 'ok:%' then
    update public.recommendation_refresh_counters
    set count = count + 1
    where user_id = p_user_id and day = current_date;
  end if;
  return result;
end;
$$;

-- ── Lock both to service_role, same reasoning as the rest of this file's siblings ──
revoke execute on function public.compute_compatibility_for_user(uuid, boolean) from public, anon, authenticated;
grant execute on function public.compute_compatibility_for_user(uuid, boolean) to service_role;

revoke execute on function public.refresh_recommendations_for_user(uuid) from public, anon, authenticated;
grant execute on function public.refresh_recommendations_for_user(uuid) to service_role;
