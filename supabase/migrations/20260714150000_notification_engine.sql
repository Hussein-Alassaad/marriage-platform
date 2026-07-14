-- Notification engine — the "post office" the Phase 2 tables were waiting for.
--
-- Shape of the thing: a feature NEVER notifies anyone directly. It emits an event into
-- `notification_events` (one insert, no knowledge of preferences, channels, or quiet
-- hours), and delivery is decided in exactly ONE place — here. That is what makes "the
-- member muted this category" a fact the platform cannot forget to honour.
--
-- Why SQL and not an Edge Function: delivery must keep working while a function is down,
-- and it must run on a schedule without a service key. A trigger + pg_cron needs neither.
--
-- Bilingual: the row stores `type` + `data`, and the CLIENT renders it through i18n. A
-- member who switches to Arabic sees their whole history in Arabic — a pre-rendered
-- string would have frozen the language at delivery time. `title`/`body` keep an English
-- fallback for the future email channel, which has no i18n runtime.
--
-- Quiet hours are real: an event that lands inside them is HELD (processed_at stays
-- null) and delivered when the window ends — not dropped, and not delivered early.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions; -- exchange rates (keyless API)

-- ── Category map ─────────────────────────────────────────────────────────────
-- An event type belongs to exactly one category, and a category is what a member mutes.
-- An unknown type falls back to `system` rather than vanishing silently.
create or replace function public.notification_category(event_type text)
returns text
language sql
immutable
as $$
  select case split_part(event_type, '.', 1)
    when 'interest'     then 'match'
    when 'match'        then 'match'
    when 'stage'        then 'match'
    when 'message'      then 'chat'
    when 'moderation'   then 'system'
    when 'guardian'     then 'family'
    when 'payment'      then 'subscription'
    when 'subscription' then 'subscription'
    when 'verification' then 'verification'
    when 'finance'      then 'finance'
    else 'system'
  end;
$$;

-- ── Quiet hours ──────────────────────────────────────────────────────────────
-- quiet_hours: {"enabled": true, "start": "22:00", "end": "07:00", "tz": "Asia/Beirut"}
-- A window that wraps midnight (22:00 → 07:00) is the normal case, so it is handled
-- explicitly. A malformed preference must never block delivery — it returns false.
create or replace function public.in_quiet_hours(quiet jsonb, at_time timestamptz)
returns boolean
language plpgsql
immutable
as $$
declare
  q jsonb := coalesce(quiet, '{}'::jsonb);
  local_time time;
  starts time;
  ends time;
begin
  if coalesce((q ->> 'enabled')::boolean, false) is not true then
    return false;
  end if;
  begin
    starts := (q ->> 'start')::time;
    ends := (q ->> 'end')::time;
    local_time := (at_time at time zone coalesce(q ->> 'tz', 'UTC'))::time;
  exception when others then
    return false;
  end;

  if starts = ends then
    return false;
  elsif starts < ends then
    return local_time >= starts and local_time < ends;
  else
    return local_time >= starts or local_time < ends; -- wraps midnight
  end if;
end;
$$;

-- ── Delivery — the single place that decides ─────────────────────────────────
-- `force` is passed by the flush job, which has already established that the member's
-- quiet-hours window has ended and their digest hour has come. Without it the flush job
-- would re-apply the "hold" rule and hold the same event forever.
--
-- Returns true when the event is finished with (delivered, or deliberately dropped
-- because the member muted it), false when it is being held for later.
--
-- Idempotent: it only acts on an event whose processed_at is null, and it sets
-- processed_at itself — so running the flush twice delivers nothing twice.
create or replace function public.deliver_notification_event(event_id uuid, force boolean default false)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  e public.notification_events%rowtype;
  prefs public.notification_preferences%rowtype;
  cat text;
  channels jsonb;
  categories jsonb;
  digest text;
  tpl public.notification_templates%rowtype;
begin
  select * into e from public.notification_events where id = event_id and processed_at is null;
  if not found then
    return true; -- already handled; never deliver twice
  end if;

  if e.user_id is null then
    update public.notification_events set processed_at = now() where id = e.id;
    return true; -- nobody to tell
  end if;

  cat := public.notification_category(e.event_type);

  select * into prefs from public.notification_preferences where user_id = e.user_id;
  channels := coalesce(prefs.channels, '{"in_app": true}'::jsonb);
  categories := coalesce(prefs.categories, '{}'::jsonb);
  digest := coalesce(prefs.digest_mode, 'immediate');

  -- The member said no. Honour it and close the event out.
  if coalesce((categories ->> cat)::boolean, true) is not true
     or coalesce((channels ->> 'in_app')::boolean, true) is not true
     or digest = 'none' then
    update public.notification_events set processed_at = now() where id = e.id;
    return true;
  end if;

  -- Not now: hold it. The flush job will come back for it.
  if not force and (digest <> 'immediate' or public.in_quiet_hours(prefs.quiet_hours, now())) then
    return false;
  end if;

  select * into tpl
  from public.notification_templates
  where type = e.event_type and locale = 'en' and active
  limit 1;

  insert into public.notifications (user_id, category, type, title, body, data)
  values (e.user_id, cat, e.event_type, coalesce(tpl.title, e.event_type), tpl.body, e.payload);

  update public.notification_events set processed_at = now() where id = e.id;
  return true;
end;
$$;

-- Immediate path: try to deliver the moment a feature emits the event.
create or replace function public.on_notification_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  perform public.deliver_notification_event(new.id);
  return new;
end;
$$;

create trigger notification_events_deliver
  after insert on public.notification_events
  for each row execute function public.on_notification_event();

-- ── Templates: English fallback text (the client renders via i18n) ───────────
insert into public.notification_templates (type, locale, title, body) values
  ('interest.received',       'en', 'Someone is interested in you',  'A member has sent you an interest request.'),
  ('interest.accepted',       'en', 'Your interest was accepted',    'You can now begin the Introduction stage.'),
  ('interest.declined',       'en', 'Interest declined',             'This connection will not continue.'),
  ('message.received',        'en', 'New message',                   'You have a new message.'),
  ('moderation.blocked',      'en', 'Message not delivered',         'Your message did not pass the safety review.'),
  ('stage.advanced',          'en', 'Your journey moved forward',    'You have both agreed to continue.'),
  ('stage.terminated',        'en', 'A connection ended',            'This connection has been ended.'),
  ('guardian.invited',        'en', 'Guardian invitation',           'You have been invited as a guardian.'),
  ('guardian.accepted',       'en', 'Your guardian accepted',        'Your guardian has confirmed the relationship.'),
  ('guardian.access_granted', 'en', 'A connection was shared',       'A connection has been shared with you.'),
  ('payment.approved',        'en', 'Payment approved',              'Your membership is now active.'),
  ('payment.rejected',        'en', 'Payment could not be verified', 'Please review your payment details.'),
  ('subscription.expiring',   'en', 'Your membership expires soon',  'Renew to keep your features.'),
  ('subscription.expired',    'en', 'Your membership has expired',   'Your account has returned to the free tier.'),
  ('verification.approved',   'en', 'You are verified',              'Matchmaking is now unlocked.'),
  ('verification.rejected',   'en', 'Verification needs attention',  'Please submit your documents again.'),
  ('finance.shared_connected','en', 'Couple Finance connected',      'You and your spouse now share monthly totals.')
on conflict (type, locale) do nothing;

-- ── Write access ─────────────────────────────────────────────────────────────
-- A client that could insert an event could forge a notification from the platform
-- itself. Events come only from Edge Functions (service role) and triggers.
-- `update` on notifications is left in place: that is how a member marks one read.
revoke insert, update, delete on public.notification_events from anon, authenticated;
revoke insert, delete on public.notifications from anon, authenticated;
revoke insert, update, delete on public.notification_templates from anon, authenticated;
