-- Voice message settings (Serious stage, Decisions Part D §2).
-- What: the admin switch that reveals voice in the UI, plus the length/size caps.
-- Why: voice needs a speech-to-text provider (Claude has no audio input), and an
--      un-transcribable voice note is an un-moderatable one. `voice_enabled` stays
--      FALSE until the STT secrets are actually set, so the mic button never appears
--      on a feature that would only fail. The server refuses regardless of this flag
--      when STT is unconfigured — the flag is UX, the server check is the boundary.

insert into public.settings (key, value, type, is_public, description) values
  ('voice_enabled', 'false', 'boolean', true,
   'Show voice messages (Serious stage+). Turn on only after STT_PROVIDER/STT_API_KEY are set.'),
  ('voice_max_seconds', '120', 'number', true,
   'Maximum length of a single voice message'),
  ('voice_max_mb', '10', 'number', true,
   'Maximum size of a single voice message, in megabytes')
on conflict (key) do nothing;
