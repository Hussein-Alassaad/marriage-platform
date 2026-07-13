-- Moderation mode — running without the AI moderator, deliberately.
-- What: an admin switch that turns the AI layer of the moderation gate off, leaving
--       the key-free local pre-filter as the only moderator.
-- Why: the AI moderator needs a funded API key. Until there is one, "AI configured but
--      unreachable" blocks every message — a dead platform. This setting makes running
--      without it an EXPLICIT, recorded decision instead of a failure state.
--
-- The distinction matters and is not cosmetic:
--   moderation_ai_enabled = true  → the AI must work. If it is unreachable, messages are
--                                   NOT delivered (fail-closed — the PRD's rule stands).
--   moderation_ai_enabled = false → the platform runs on the local pre-filter alone. It
--                                   catches phone numbers, emails, links, @handles, the
--                                   named platforms, and romance including obfuscated
--                                   forms — but it CANNOT read intent. A cleverly worded
--                                   hint at a handle will get through.
--
-- Turn this back to true the moment the API key is funded.

insert into public.settings (key, value, type, is_public, description) values
  ('moderation_ai_enabled', 'true', 'boolean', false,
   'Use the AI moderator. When false the platform runs on the local pre-filter alone (weaker: it cannot read intent).')
on conflict (key) do nothing;
