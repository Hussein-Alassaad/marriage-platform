// Edge Function: send-image-message
// Images unlock at the Family stage (Decisions Part D §3), capped per day from
// settings (`family_images_per_day`). Married has no cap.
//
// Claude can see, so the image is moderated BEFORE it is stored: receive → moderate
// → only then upload. FAIL-CLOSED — no moderator, an unreachable moderator, or a
// violation means the image is not delivered and never reaches storage. There is no
// local pre-filter for pixels, so an unconfigured moderator blocks images entirely
// rather than letting an unreviewed one through.
//
// Request: multipart/form-data — `matchId`, `image` (blob).
// Deploy: supabase functions deploy send-image-message

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { moderateImage, POLICY_VERSION } from '../_shared/moderation.ts';
import { secret } from '../_shared/env.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

const MEDIA_STAGES = new Set(['family', 'married']);
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

async function setting<T>(admin: SupabaseClient, key: string, fallback: T): Promise<T> {
  const { data } = await admin.from('settings').select('value').eq('key', key).maybeSingle();
  return (data?.value ?? fallback) as T;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000; // avoid blowing the call stack on large buffers
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anthropicKey = secret('ANTHROPIC_API_KEY');
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
  const image = form.get('image');
  if (!matchId || !(image instanceof File)) return json({ error: 'bad_request' }, 400);

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

    const type = image.type.split(';')[0];
    if (!IMAGE_TYPES.has(type)) return json({ error: 'unsupported_type' }, 415);

    const maxBytes = (Number(await setting(admin, 'media_max_mb', 10)) || 10) * 1024 * 1024;
    if (image.size > maxBytes) return json({ error: 'too_large', maxBytes }, 413);

    // Family has a daily cap; Married does not (Part D §4).
    const today = new Date().toISOString().slice(0, 10);
    let cap = 0;
    let used = 0;
    if (stage === 'family') {
      const [{ data: capSetting }, { data: counter }] = await Promise.all([
        admin.from('settings').select('value').eq('key', 'family_images_per_day').maybeSingle(),
        admin
          .from('daily_media_counters')
          .select('count')
          .eq('user_id', uid)
          .eq('media_kind', 'image')
          .eq('day', today)
          .maybeSingle(),
      ]);
      cap = Number(capSetting?.value ?? 3) || 3;
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

    const audit = (row: Record<string, unknown>) =>
      admin.from('message_moderation').insert({
        conversation_id: conversationId,
        sender_id: uid,
        stage,
        policy_version: POLICY_VERSION,
        ...row,
      });

    // Moderate the pixels before they are ever written anywhere.
    const bytes = new Uint8Array(await image.arrayBuffer());
    const verdict = await moderateImage(toBase64(bytes), type, anthropicKey);
    if (verdict.blocked) {
      await audit({
        verdict: 'blocked',
        category: verdict.category,
        provider: verdict.provider,
        model: verdict.model,
        prompt_version: verdict.promptVersion,
      });
      return json({ blocked: true, category: verdict.category });
    }

    const path = `${conversationId}/${crypto.randomUUID()}.${EXT[type]}`;
    const { error: upErr } = await admin.storage
      .from('chat-images')
      .upload(path, image, { contentType: type, upsert: false });
    if (upErr) return json({ error: upErr.message }, 400);

    const { data: message, error: mErr } = await admin
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: uid,
        type: 'image',
        media_path: path,
        media_status: 'approved',
      })
      .select('id')
      .single();
    if (mErr) {
      await admin.storage.from('chat-images').remove([path]);
      return json({ error: mErr.message }, 400);
    }

    const after: Promise<unknown>[] = [
      audit({
        message_id: message.id,
        verdict: 'allowed',
        provider: verdict.provider,
        model: verdict.model,
        prompt_version: verdict.promptVersion,
      }),
      admin.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId),
    ];
    let remaining: number | null = null;
    if (stage === 'family') {
      after.push(
        admin
          .from('daily_media_counters')
          .upsert(
            { user_id: uid, media_kind: 'image', day: today, count: used + 1 },
            { onConflict: 'user_id,media_kind,day' },
          ),
      );
      remaining = Math.max(0, cap - (used + 1));
    }
    await Promise.all(after);

    return json({ ok: true, conversationId, messageId: message.id, remaining });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'unexpected_error' }, 500);
  }
});
