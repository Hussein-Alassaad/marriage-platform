-- Conversations & messages — the platform's most security-critical surface.
-- What: conversations (direct or family group), participants, messages of type
--       text/voice/image/video, moderation records (with provider/model/prompt/
--       policy versioning — improvement #2), per-conversation + per-day counters,
--       and the violation ladder. Messages and matches are soft-deleted.
-- Why: clients can NEVER insert a message — only the send-*-message Edge
--      Functions (service_role) may, after moderation. A trigger also enforces
--      which media types a stage permits, as defense-in-depth (Decisions Part D).

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind public.conversation_kind not null default 'direct',
  match_id uuid references public.matches (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null
);
create index conversations_match_idx on public.conversations (match_id);

create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

create table public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.user_role not null default 'user', -- 'user' | 'guardian'
  joined_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (conversation_id, user_id)
);
create index conversation_participants_user_idx on public.conversation_participants (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  type public.message_type not null default 'text',
  body text, -- text content (null for pure media)
  media_path text, -- path in chat-voice / chat-images / chat-videos
  media_status public.media_status not null default 'approved',
  transcript text, -- voice: moderated speech-to-text transcript
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null,
  constraint messages_media_present check (
    (type = 'text' and body is not null) or (type <> 'text' and media_path is not null)
  )
);
comment on table public.messages is 'Only the send-*-message Edge Functions (service_role) insert here. No client writes.';
create index messages_conversation_idx on public.messages (conversation_id, created_at) where deleted_at is null;

create table public.message_moderation (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.messages (id) on delete set null, -- null for blocked attempts
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  verdict public.moderation_verdict not null,
  category text,
  confidence numeric(4, 3),
  rewrite_suggestion text,
  original_text text, -- the attempted content (for the escalation ladder / review)
  stage public.journey_stage,
  -- Versioning (improvement #2): decisions stay traceable as AI/prompts evolve.
  provider text,
  model text,
  prompt_version text,
  policy_version text,
  moderated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index message_moderation_conversation_idx on public.message_moderation (conversation_id, created_at desc);
create index message_moderation_sender_idx on public.message_moderation (sender_id, created_at desc);

-- Moderation records are append-only.
create trigger message_moderation_immutable
  before update or delete on public.message_moderation
  for each row execute function public.prevent_mutation();

-- Introduction message quota (delivered messages only). Maintained by the
-- send-text-message Edge Function; read by clients to show "N of 10 remaining".
create table public.message_counters (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  sent_count integer not null default 0,
  primary key (conversation_id, user_id)
);

-- Family-stage per-day media quota (default 3 images / 2 videos, admin-configurable).
create table public.daily_media_counters (
  user_id uuid not null references auth.users (id) on delete cascade,
  media_kind public.message_type not null, -- 'image' | 'video'
  day date not null default current_date,
  count integer not null default 0,
  primary key (user_id, media_kind, day)
);

-- Violation escalation ladder (block → warning → temp suspension → admin review).
create table public.violations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null,
  severity smallint not null default 1,
  moderation_id uuid references public.message_moderation (id) on delete set null,
  created_at timestamptz not null default now()
);
create index violations_user_idx on public.violations (user_id, created_at desc);

-- Participant check (defined here now that conversation_participants exists is
-- not required — the SECURITY DEFINER version from the foundation is used).

-- Defense-in-depth: block message types a stage does not permit (Part D).
create or replace function public.enforce_message_stage_rules()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  current_stage public.journey_stage;
begin
  select m.stage into current_stage
  from public.conversations c
  join public.matches m on m.id = c.match_id
  where c.id = new.conversation_id;

  if current_stage is null then
    return new; -- no match context (should not happen for chat messages)
  end if;

  if current_stage = 'introduction' and new.type <> 'text' then
    raise exception 'Introduction Stage allows text only';
  elsif current_stage = 'serious_communication' and new.type not in ('text', 'voice') then
    raise exception 'Serious Communication Stage allows text and voice only';
  elsif current_stage in ('interest_sent', 'terminated') then
    raise exception 'Messaging is not available in stage %', current_stage;
  end if;
  -- family & married: all media types permitted (daily limits enforced in the
  -- Edge Function against settings + daily_media_counters).
  return new;
end;
$$;
create trigger messages_enforce_stage
  before insert on public.messages
  for each row execute function public.enforce_message_stage_rules();

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.message_moderation enable row level security;
alter table public.message_counters enable row level security;
alter table public.daily_media_counters enable row level security;
alter table public.violations enable row level security;

-- Conversations/messages: participants only. Admins are intentionally excluded
-- here — moderation access is flag-tied and audit-logged (Phase 8/14), not a
-- blanket read of private conversations.
create policy conversations_read_participant on public.conversations
  for select using (deleted_at is null and public.is_conversation_participant(id));

create policy participants_read_member on public.conversation_participants
  for select using (user_id = auth.uid() or public.is_conversation_participant(conversation_id));

create policy messages_read_participant on public.messages
  for select using (deleted_at is null and public.is_conversation_participant(conversation_id));

-- A sender can see moderation results for their own messages (why blocked +
-- suggested rewrite); admins can review all.
create policy message_moderation_read_own on public.message_moderation
  for select using (sender_id = auth.uid() or public.is_admin());

create policy message_counters_read_participant on public.message_counters
  for select using (public.is_conversation_participant(conversation_id));

create policy daily_media_counters_read_own on public.daily_media_counters
  for select using (user_id = auth.uid());

create policy violations_read_own on public.violations
  for select using (user_id = auth.uid() or public.is_admin());
