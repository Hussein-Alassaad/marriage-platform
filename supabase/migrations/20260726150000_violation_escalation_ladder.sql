-- Violation escalation ladder (Decisions Part D "Violation handling", Roadmap Phase 8).
--
-- Found in the requirements audit: the `violations` table has existed since Phase 2
-- with a comment describing "block → warning → temp suspension → admin review" and
-- even RLS/grants set up for it — but nothing anywhere ever inserted a row. A member
-- could repeatedly trip moderation and nothing ever escalated.
--
-- The ladder, exactly as specified:
--   1st violation — block the message, explain why (already happens: the moderator
--                   returns a category + reason, surfaced to the sender).
--   2nd violation — official warning (a notification, no other effect).
--   3rd violation — temporary communication suspension. Reuses the account-suspension
--                   mechanism from 20260714170000_admin_moderation.sql (`profiles.status`
--                   + `suspended_until`, already checked at every point of action via
--                   `is_account_active()`) rather than inventing a narrower
--                   "communication-only" suspension — sending a message already goes
--                   through that exact check.
--   Repeated (5+) or severe (inappropriate/scam/unsafe) — flagged for admin review.
--
-- `record_violation` is called by every send-*-message function when the moderator
-- BLOCKS a message for a real content reason. It is NOT called for `category =
-- 'unavailable'` (the moderator itself failed — not the member's fault) or for
-- non-moderation blocks like a quota. Fail-closed already stops the message in those
-- cases; this ladder is specifically about repeated genuine rule-breaking.

alter table public.violations
  add column if not exists requires_review boolean not null default false,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users (id) on delete set null;

create index if not exists violations_review_idx
  on public.violations (requires_review) where requires_review and reviewed_at is null;

create or replace function public.violation_severity(p_category text)
returns smallint
language sql
immutable
as $$
  select case p_category
    when 'inappropriate' then 3
    when 'scam' then 3
    when 'unsafe' then 3
    when 'haram_meeting' then 2
    when 'contact_info' then 1
    when 'too_soon' then 1
    else 1
  end;
$$;

create or replace function public.record_violation(
  p_user_id uuid,
  p_category text,
  p_moderation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  sev smallint := public.violation_severity(p_category);
  prior_total integer;
  total integer;
  repeated_threshold constant integer := 5;
  suspension_days integer;
  action text := 'blocked';
begin
  select count(*) into prior_total from public.violations where user_id = p_user_id;
  total := prior_total + 1;

  insert into public.violations (user_id, category, severity, moderation_id, requires_review)
  values (p_user_id, p_category, sev, p_moderation_id, sev >= 3 or total >= repeated_threshold);

  if total = 2 then
    action := 'warning';
    insert into public.notification_events (event_type, user_id, payload)
    values ('moderation.warning', p_user_id, jsonb_build_object('count', total));
  elsif total >= 3 then
    select coalesce((select value #>> '{}' from public.settings where key = 'violation_suspension_days')::integer, 3)
    into suspension_days;

    -- Never downgrade an existing harsher admin action (e.g. a manual ban) into a
    -- shorter automatic suspension.
    update public.profiles
    set status = 'suspended',
        suspended_until = now() + make_interval(days => suspension_days),
        suspension_reason = 'automatic: repeated moderation violations'
    where id = p_user_id and status = 'active';
    action := 'suspended';

    insert into public.notification_events (event_type, user_id, payload)
    values ('moderation.suspended', p_user_id, jsonb_build_object('count', total, 'days', suspension_days));
  end if;

  return jsonb_build_object('total', total, 'severity', sev, 'action', action);
end;
$$;

revoke execute on function public.record_violation(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.record_violation(uuid, text, uuid) to service_role;

-- `violation_severity` is pure/read-only with no side effects; no lockdown needed.

insert into public.settings (key, value, type, is_public, description) values
  ('violation_suspension_days', '3', 'number', false,
   'Days a member is auto-suspended on their 3rd moderation violation (Decisions Part D)')
on conflict (key) do nothing;

insert into public.notification_templates (type, locale, title, body) values
  ('moderation.warning', 'en', 'Official warning',
   'You have received an official warning for repeated messages that did not pass review. A further violation will temporarily suspend your ability to send messages.'),
  ('moderation.suspended', 'en', 'Messaging temporarily suspended',
   'Your account has been temporarily suspended due to repeated moderation violations.')
on conflict (type, locale) do nothing;
