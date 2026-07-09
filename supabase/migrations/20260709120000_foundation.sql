-- Foundation: extensions, enums, and shared helper/trigger functions.
-- What: the primitives every later migration builds on.
-- Why: one source of truth for enums (journey stage, roles, message type, …) and
--      for the SECURITY DEFINER helpers RLS policies call (is_admin, participant
--      checks) so policies never recurse and rules live in one place.

-- Allow the helper functions below to forward-reference tables created in later
-- migrations (user_roles, conversation_participants). Session-scoped to this file.
set check_function_bodies = off;

-- ── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists pgcrypto with schema extensions; -- gen_random_uuid()
create extension if not exists citext with schema extensions; -- case-insensitive text

-- ── Enums ───────────────────────────────────────────────────────────────────
create type public.user_role as enum ('user', 'guardian', 'admin', 'super_admin', 'moderator');
create type public.gender as enum ('man', 'woman');

-- One canonical journey model (Decisions #1–#4 / Part D).
create type public.journey_stage as enum (
  'interest_sent',
  'introduction',
  'serious_communication',
  'family',
  'married',
  'terminated'
);

create type public.subscription_tier as enum ('free', 'serious', 'marriage_plus');
create type public.message_type as enum ('text', 'voice', 'image', 'video');
create type public.moderation_verdict as enum ('approved', 'blocked', 'rewritten', 'pending');
create type public.moderation_mode as enum ('strict', 'safety_only');
create type public.verification_status as enum ('unverified', 'pending', 'verified', 'rejected');
create type public.interest_status as enum ('sent', 'accepted', 'declined', 'expired', 'cancelled');
create type public.media_status as enum ('pending', 'approved', 'rejected');
create type public.setting_type as enum ('number', 'boolean', 'string', 'json');
create type public.notification_channel as enum ('in_app', 'email', 'sms', 'whatsapp', 'push');
create type public.payment_method as enum ('card', 'omt', 'whish', 'bank_transfer');
create type public.payment_status as enum ('pending', 'approved', 'rejected', 'activated', 'expired');
create type public.conversation_kind as enum ('direct', 'family_group');

-- ── Trigger: keep updated_at current ────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── Trigger: make a table append-only (block UPDATE/DELETE) ──────────────────
-- Used for immutable audit surfaces (stage_history, audit_logs, settings_history,
-- message_moderation) so history cannot be rewritten.
create or replace function public.prevent_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Table %.% is append-only; % is not permitted',
    tg_table_schema, tg_table_name, tg_op;
end;
$$;

-- ── RLS helpers (SECURITY DEFINER so they bypass RLS and never recurse) ──────
-- Role check. Reads user_roles with the definer's privileges to avoid a policy
-- on user_roles calling back into itself.
create or replace function public.has_role(target public.user_role)
returns boolean
language sql
security definer
stable
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = auth.uid() and r.role = target
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = auth.uid() and r.role in ('admin', 'super_admin')
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
stable
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = auth.uid() and r.role = 'super_admin'
  );
$$;

-- Is the current user a (non-deleted) participant of a conversation?
-- Drives read access to conversations/messages without recursive policies.
create or replace function public.is_conversation_participant(target uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.conversation_participants p
    where p.conversation_id = target
      and p.user_id = auth.uid()
      and p.deleted_at is null
  );
$$;

comment on function public.is_admin() is 'True if the current user holds admin or super_admin. Used by RLS.';
comment on function public.prevent_mutation() is 'Trigger to enforce append-only (immutable) tables.';
