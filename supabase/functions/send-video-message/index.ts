// Edge Function: send-video-message
// Videos unlock at the Family stage (Decisions Part D §3), capped per day from
// settings (`family_videos_per_day`). Married has no cap.
//
// IMPORTANT — no model can watch a video, so a video CANNOT be auto-moderated the way
// text, transcripts and images are. Rather than pretend, a video is stored with
// `media_status = 'pending'` and is NOT viewable by the recipient: `chat-media` refuses
// to sign anything that is not `approved`. An admin approves or rejects it in the media
// queue, and only then can the other person open it. "Deliver only after approval"
// (Part D §5) is honoured literally.
//
// Request: multipart/form-data — `matchId`, `video` (blob).
// Deploy: supabase functions deploy send-video-message

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { POLICY_VERSION } from '../_shared/moderation.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

const MEDIA_STAGES = new Set(['family', 'married']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const EXT: Record<string, string> = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };

async function setting<T>(admin: SupabaseClient, key: string, fallback: T): Promise<T> {
  const { data } = await admin.from('settings').select('value').eq('key', key).maybeSingle();
  return (data?.value ?? fallback) as T;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization') ?? '';

  const asUser = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData } = await asUser.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(url, serviceKey);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const matchId = String(form.get('matchId') ?? '');
  const video = form.get('video');
  if (!matchId || !(video instanceof File)) return json({ error: 'bad_request' }, 400);

  try {
    const { data: match } = await admin
      .from('matches')
      .select('id, user_a, user_b, stage, deleted_at')
      .eq('id', matchId)
      .maybeSingle();
    if (!match || match.deleted_at || (match.user_a !== uid && match.user_b !== uid)) {
      return json({ error: 'not_a_participant' }, 403);
    }
    const stage = match.stage as string;
    if (!MEDIA_STAGES.has(stage)) return json({ error: 'stage_not_allowed' }, 409);

    const type = video.type.split(';')[0];
    if (!VIDEO_TYPES.has(type)) return json({ error: 'unsupported_type' }, 415);

    const maxBytes = (Number(await setting(admin, 'video_max_mb', 50)) || 50) * 1024 * 1024;
    if (video.size > maxBytes) return json({ error: 'too_large', maxBytes }, 413);

    const today = new Date().toISOString().slice(0, 10);
    let cap = 0;
    let used = 0;
    if (stage === 'family') {
      const [{ data: capSetting }, { data: counter }] = await Promise.all([
        admin.from('settings').select('value').eq('key', 'family_videos_per_day').maybeSingle(),
        admin
          .from('daily_media_counters')
          .select('count')
          .eq('user_id', uid)
          .eq('media_kind', 'video')
          .eq('day', today)
          .maybeSingle(),
      ]);
      cap = Number(capSetting?.value ?? 2) || 2;
      used = counter?.count ?? 0;
      if (used >= cap) return json({ blocked: true, category: 'quota', remaining: 0 });
    }

    const { data: conv } = await admin
      .from('conversations')
      .select('id')
      .eq('match_id', matchId)
      .eq('kind', 'direct')
      .is('deleted_at', null)
      .maybeSingle();
    if (!conv) return json({ error: 'no_conversation' }, 409);
    const conversationId = conv.id;

    const path = `${conversationId}/${crypto.randomUUID()}.${EXT[type]}`;
    const { error: upErr } = await admin.storage
      .from('chat-videos')
      .upload(path, video, { contentType: type, upsert: false });
    if (upErr) return json({ error: upErr.message }, 400);

    // 'pending' is the whole point: the recipient cannot open it until a human says so.
    const { data: message, error: mErr } = await admin
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: uid,
        type: 'video',
        media_path: path,
        media_status: 'pending',
      })
      .select('id')
      .single();
    if (mErr) {
      await admin.storage.from('chat-videos').remove([path]);
      return json({ error: mErr.message }, 400);
    }

    const after: Promise<unknown>[] = [
      admin.from('message_moderation').insert({
        message_id: message.id,
        conversation_id: conversationId,
        sender_id: uid,
        verdict: 'pending',
        stage,
        policy_version: POLICY_VERSION,
        provider: 'human',
        model: 'admin_review',
      }),
      admin.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId),
    ];
    let remaining: number | null = null;
    if (stage === 'family') {
      after.push(
        admin
          .from('daily_media_counters')
          .upsert(
            { user_id: uid, media_kind: 'video', day: today, count: used + 1 },
            { onConflict: 'user_id,media_kind,day' },
          ),
      );
      remaining = Math.max(0, cap - (used + 1));
    }
    await Promise.all(after);

    return json({ ok: true, pending: true, conversationId, messageId: message.id, remaining });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'unexpected_error' }, 500);
  }
});
