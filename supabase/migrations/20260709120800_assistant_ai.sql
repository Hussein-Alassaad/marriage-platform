-- Marriage Assistant & AI plumbing.
-- What: private assistant chats/messages, consent-based memory, versioned prompt
--       templates, and ai_requests — the analytics foundation for the AI
--       Dashboard (improvement #3): provider, model, feature, latency, tokens,
--       estimated cost, timestamp.
-- Why: assistant content is private (never visible to admins). ai_requests lets
--      us monitor AI usage, cost, and performance across every feature over time.

create table public.assistant_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assistant_chats_user_idx on public.assistant_chats (user_id, updated_at desc);

create table public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.assistant_chats (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);
create index assistant_messages_chat_idx on public.assistant_messages (chat_id, created_at);

-- Consent-based memory: the user can view, delete, reset, or disable it.
create table public.assistant_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  value jsonb not null,
  consented boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

-- Versioned, bilingual prompt templates — editable without a redeploy.
create table public.prompt_templates (
  id uuid primary key default gen_random_uuid(),
  task text not null, -- moderate_message, assistant_chat, conversation_summary, compatibility_explain, …
  version text not null default 'v1',
  locale text not null default 'any', -- 'en' | 'ar' | 'any'
  content text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task, version, locale)
);

-- AI usage log — one row per AI call. Feeds the AI Dashboard.
create table public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  feature text not null, -- compatibility_engine | marriage_assistant | conversation_summary | ai_moderation | translation | speech_to_text | profile_coach | photo_review | finance_insight
  provider text,
  model text,
  latency_ms integer,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  estimated_cost numeric(12, 6),
  status text not null default 'ok', -- ok | error | timeout | fallback
  requested_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index ai_requests_feature_time_idx on public.ai_requests (feature, requested_at desc);
create index ai_requests_user_idx on public.ai_requests (user_id, requested_at desc);

-- updated_at triggers
create trigger assistant_chats_set_updated_at before update on public.assistant_chats for each row execute function public.set_updated_at();
create trigger assistant_memory_set_updated_at before update on public.assistant_memory for each row execute function public.set_updated_at();
create trigger prompt_templates_set_updated_at before update on public.prompt_templates for each row execute function public.set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.assistant_chats enable row level security;
alter table public.assistant_messages enable row level security;
alter table public.assistant_memory enable row level security;
alter table public.prompt_templates enable row level security;
alter table public.ai_requests enable row level security;

-- Assistant content is strictly private to the owner (never admin-visible).
create policy assistant_chats_rw_own on public.assistant_chats
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy assistant_messages_rw_own on public.assistant_messages
  for all using (
    exists (select 1 from public.assistant_chats c where c.id = chat_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.assistant_chats c where c.id = chat_id and c.user_id = auth.uid())
  );

create policy assistant_memory_rw_own on public.assistant_memory
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Prompt templates: admin-only (internal). No client writes.
create policy prompt_templates_read_admin on public.prompt_templates
  for select using (public.is_admin());

-- AI usage: a user may read their own rows; admins read all (dashboard).
create policy ai_requests_read_own on public.ai_requests
  for select using (user_id = auth.uid() or public.is_admin());
