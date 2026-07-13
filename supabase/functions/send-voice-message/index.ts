// Edge Function: send-voice-message
// Voice notes unlock at the Serious stage (Decisions Part D §2). The pipeline is
// strictly: receive → transcribe → moderate the transcript → only then store and
// deliver. A voice note that cannot be transcribed cannot be moderated, and an
// un-moderated voice note is never delivered — that is the whole point.
//
// FAIL-CLOSED at every step:
//   no STT provider configured  → 503, nothing stored
//   transcription fails         → 503, nothing stored
//   moderator unreachable       → blocked, nothing stored
//   transcript violates Part D  → blocked, nothing stored (the audio is discarded)
//
// The audio only reaches the private `chat-voice` bucket AFTER it passes.
//
// Request: multipart/form-data — `matchId`, `audio` (blob), optional `durationMs`.
// Secrets: STT_PROVIDER + STT_API_KEY (see ../_shared/transcribe.ts), ANTHROPIC_API_KEY.
// Deploy: supabase functions deploy send-voice-message

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { moderate, POLICY_VERSION } from '../_shared/moderation.ts';
import { isConfigured, transcribe } from '../_shared/transcribe.ts';
import { secret } from '../_shared/env.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

/** Voice is a Serious-stage feature and stays available in the later stages. */
const VOICE_STAGES = new Set(['serious_communication', 'family', 'married']);
const AUDIO_TYPES = new Set(['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav']);
const EXT: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
};

async function setting<T>(admin: SupabaseClient, key: string, fallback: T): Promise<T> {
  const { data } = await admin.from('settings').select('value').eq('key', key).maybeSingle();
  return (data?.value ?? fallback) as T;
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

  // No transcription ⇒ no moderation ⇒ no delivery. Refuse before reading the body.
  if (!isConfigured()) return json({ error: 'voice_unavailable' }, 503);

  const admin = createClient(url, serviceKey);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const matchId = String(form.get('matchId') ?? '');
  const audio = form.get('audio');
  const durationMs = Number(form.get('durationMs') ?? 0) || 0;
  if (!matchId || !(audio instanceof File)) return json({ error: 'bad_request' }, 400);

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
    if (!VOICE_STAGES.has(stage)) return json({ error: 'stage_not_allowed' }, 409);

    const type = audio.type.split(';')[0];
    if (!AUDIO_TYPES.has(type)) return json({ error: 'unsupported_type' }, 415);

    const maxSeconds = Number(await setting(admin, 'voice_max_seconds', 120)) || 120;
    const maxBytes = (Number(await setting(admin, 'voice_max_mb', 10)) || 10) * 1024 * 1024;
    if (audio.size > maxBytes) return json({ error: 'too_large', maxBytes }, 413);
    if (durationMs > maxSeconds * 1000) return json({ error: 'too_long', maxSeconds }, 413);

    // The conversation is created by the first text message, but don't assume it.
    let conversationId: string;
    const { data: conv } = await admin
      .from('conversations')
      .select('id')
      .eq('match_id', matchId)
      .eq('kind', 'direct')
      .is('deleted_at', null)
      .maybeSingle();
    if (conv) {
      conversationId = conv.id;
    } else {
      const { data: created, error: cErr } = await admin
        .from('conversations')
        .insert({ kind: 'direct', match_id: matchId })
        .select('id')
        .single();
      if (cErr) return json({ error: cErr.message }, 400);
      conversationId = created.id;
      await admin.from('conversation_participants').insert([
        { conversation_id: conversationId, user_id: match.user_a, role: 'user' },
        { conversation_id: conversationId, user_id: match.user_b, role: 'user' },
      ]);
    }

    const audit = (row: Record<string, unknown>) =>
      admin.from('message_moderation').insert({
        conversation_id: conversationId,
        sender_id: uid,
        stage,
        policy_version: POLICY_VERSION,
        ...row,
      });

    // 1. Transcribe. A failure here is fatal — we cannot judge what we cannot read.
    let transcript: string;
    try {
      transcript = await transcribe(audio, `voice.${EXT[type] ?? 'webm'}`);
    } catch (err) {
      console.error('transcription_failed', err);
      await audit({ verdict: 'blocked', category: 'unavailable', provider: 'stt', model: 'transcribe' });
      return json({ error: 'transcription_failed' }, 503);
    }
    if (!transcript) return json({ blocked: true, category: 'empty_transcript' });

    // 2. Moderate the transcript — the same Part D gate the text sender uses, including
    //    the admin switch for the AI layer (see send-text-message).
    const aiEnabled = (await setting(admin, 'moderation_ai_enabled', true)) !== false;
    const verdict = await moderate(transcript, stage, aiEnabled ? anthropicKey : null);
    if (verdict.blocked) {
      await audit({
        verdict: 'blocked',
        category: verdict.category,
        original_text: transcript,
        provider: verdict.provider,
        model: verdict.model,
        prompt_version: verdict.promptVersion,
      });
      // The audio was never stored — there is nothing to delete.
      return json({ blocked: true, category: verdict.category });
    }

    // 3. Only now does the audio touch storage (private bucket, server-only reads).
    const path = `${conversationId}/${crypto.randomUUID()}.${EXT[type] ?? 'webm'}`;
    const { error: upErr } = await admin.storage
      .from('chat-voice')
      .upload(path, audio, { contentType: type, upsert: false });
    if (upErr) return json({ error: upErr.message }, 400);

    const { data: message, error: mErr } = await admin
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: uid,
        type: 'voice',
        media_path: path,
        media_status: 'approved',
        transcript,
      })
      .select('id, created_at')
      .single();
    if (mErr) {
      // Don't leave an orphaned file behind if the row failed to land.
      await admin.storage.from('chat-voice').remove([path]);
      return json({ error: mErr.message }, 400);
    }

    await Promise.all([
      audit({
        message_id: message.id,
        verdict: 'allowed',
        original_text: transcript,
        provider: verdict.provider,
        model: verdict.model,
        prompt_version: verdict.promptVersion,
      }),
      admin.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId),
    ]);

    return json({ ok: true, conversationId, messageId: message.id, transcript });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'unexpected_error' }, 500);
  }
});
