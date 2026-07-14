-- Marriage Assistant settings (Phase 11).
--
-- `assistant_enabled` is FALSE, and that is not a bug. The assistant is the one feature
-- with no key-free fallback: moderation has a pre-filter, suggestions have a curated list,
-- but an assistant with no model has nothing to say. Showing a chat box that always
-- answers "unavailable" is worse than showing an honest "not yet" — so the switch stays
-- off until ANTHROPIC_API_KEY is funded, and then one setting turns the whole feature on
-- with no redeploy.
--
-- Guidance mode is Islamic by default (Decisions): the assistant speaks within an Islamic
-- frame for marriage questions, and refuses to issue religious rulings — it points to a
-- scholar. Admins can widen it to 'general' for a different deployment.

insert into public.settings (key, value, type, is_public, description) values
  ('assistant_enabled', 'false', 'boolean', true,
   'Show the Marriage Assistant. Requires ANTHROPIC_API_KEY; off until it is funded.'),
  ('assistant_guidance_mode', '"islamic"', 'string', false,
   'Assistant guidance frame: islamic | general. Never issues religious rulings either way.'),
  ('assistant_daily_marriage_plus', '0', 'number', false,
   'Marriage Assistant daily conversations — Marriage Plus. 0 = unlimited.'),
  ('assistant_memory_default', 'true', 'boolean', true,
   'Whether assistant memory starts switched on for a new member (they can always turn it off)')
on conflict (key) do nothing;

-- Message counts per chat are needed for the daily limit; a chat is "used" the day it is
-- created, which is the unit the PRD counts ("daily conversations", not daily messages).
create index if not exists assistant_chats_user_day_idx
  on public.assistant_chats (user_id, created_at desc);

-- Assistant chats are the most private thing on the platform: they contain what a member
-- would tell nobody else. There is NO admin policy on these tables (Phase 2), and there
-- will not be one.
--
-- Writes go through the `assistant` Edge Function, so the daily limit cannot be bypassed
-- by inserting rows directly. DELETE is deliberately left to the client: erasing your own
-- history must not require the server's permission — that is what makes it yours. Memory
-- stays fully client-writable for the same reason.
revoke insert, update on public.assistant_chats from anon, authenticated;
revoke insert, update on public.assistant_messages from anon, authenticated;
