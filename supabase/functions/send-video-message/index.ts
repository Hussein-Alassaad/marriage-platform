// Edge Function: send-video-message
//
// VIDEO IS DISABLED FOR THIS RELEASE — "Coming Soon".
//
// Why: no model can watch a video, so there is no scalable way to moderate one. The
// earlier build held videos for human review, which worked but does not scale. Rather
// than ship an unmoderated media channel (or a review queue nobody can staff), the
// endpoint refuses every upload and the UI marks the feature as coming soon.
//
// This function stays in place, and the rest of the media pipeline is untouched, so
// enabling video later is an additive change:
//
//   1. Add a video moderation step (frame sampling into Claude vision, or a
//      video-capable moderation provider) in the marked section below.
//   2. Only on an "allowed" verdict: upload to the private `chat-videos` bucket and
//      insert a `messages` row of type 'video' with `media_status = 'approved'`,
//      exactly as `send-image-message` does today.
//   3. Enforce the daily cap from the `family_videos_per_day` setting against
//      `daily_media_counters`, and the size cap from `video_max_mb`.
//   4. Flip VIDEO_ENABLED to true and reveal the button in `MediaComposer`.
//
// Everything that would deliver a video is downstream of that moderation step, so
// nothing can leak while this flag is false: `chat-media` only ever signs media whose
// `media_status` is 'approved', and no code path can produce such a row for a video.
//
// Deploy: supabase functions deploy send-video-message

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

/** Flip to true only once a real video moderation step exists above. */
const VIDEO_ENABLED = false;

Deno.serve((req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  if (!VIDEO_ENABLED) {
    // Refuse before reading the body — we don't want an unmoderatable file in memory.
    return json({ error: 'video_coming_soon' }, 501);
  }

  // ── Future: authenticate → stage check → caps → MODERATE THE VIDEO → upload →
  //    insert the message with media_status 'approved' → bump daily_media_counters.
  return json({ error: 'video_coming_soon' }, 501);
});
