-- Family-stage media settings (Decisions Part D §3).
-- What: size caps for chat images/videos, and the admin switch that reveals media
--       in the UI. The per-day counts (`family_images_per_day`, `family_videos_per_day`)
--       were already seeded in the settings migration.
-- Why: images are moderated by the AI before storage, but **no model can watch a
--      video** — so videos are held at `media_status = 'pending'` until a human
--      approves them, and `chat-media` refuses to sign anything not approved. That
--      makes "deliver only after approval" literally true. `media_enabled` stays
--      FALSE until ANTHROPIC_API_KEY is set, because an unmoderatable image is one
--      the platform must refuse — showing the button would only produce failures.

insert into public.settings (key, value, type, is_public, description) values
  ('media_enabled', 'false', 'boolean', true,
   'Show image/video sending (Family stage+). Turn on only after ANTHROPIC_API_KEY is set.'),
  ('media_max_mb', '10', 'number', true,
   'Maximum size of a chat image, in megabytes'),
  ('video_max_mb', '50', 'number', true,
   'Maximum size of a chat video, in megabytes')
on conflict (key) do nothing;
