// Edge Function: chat-media
// The chat-voice / chat-images / chat-videos buckets have NO client policies —
// privacy is enforced by which file the server hands you. This function is that
// server: it verifies the caller is a participant of the message's conversation,
// then issues a short-lived signed URL for exactly that one file.
//
// Action (JSON body): { messageId } → { url, expiresIn }
//
// It signs ONLY media whose `media_status` is 'approved' — i.e. media that actually
// passed moderation before it was stored (voice via its transcript, images via Claude
// vision). That check is the reason an unmoderated file can never be handed to anyone,
// and it is what a future video moderation step will slot behind.
//
// Deploy: `supabase functions deploy chat-media`.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

const BUCKET: Record<string, string> = {
  voice: 'chat-voice',
  image: 'chat-images',
  video: 'chat-videos',
};
const TTL_SECONDS = 600;

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
  const { messageId } = await req.json().catch(() => ({}));
  if (!messageId) return json({ error: 'message_required' }, 400);

  try {
    const { data: message } = await admin
      .from('messages')
      .select('id, conversation_id, type, media_path, media_status, deleted_at')
      .eq('id', messageId)
      .maybeSingle();
    if (!message || message.deleted_at || !message.media_path) return json({ error: 'not_found' }, 404);
    // Anything that did not pass moderation is not signable, full stop.
    if (message.media_status !== 'approved') return json({ error: 'not_available' }, 409);

    // Participation is the whole permission check — including guardians, who are
    // participants of the family conversation and nothing else.
    const { data: participant } = await admin
      .from('conversation_participants')
      .select('id')
      .eq('conversation_id', message.conversation_id)
      .eq('user_id', uid)
      .is('deleted_at', null)
      .maybeSingle();
    if (!participant) return json({ error: 'forbidden' }, 403);

    const bucket = BUCKET[message.type as string];
    if (!bucket) return json({ error: 'not_media' }, 400);

    const { data, error } = await admin.storage.from(bucket).createSignedUrl(message.media_path, TTL_SECONDS);
    if (error || !data?.signedUrl) return json({ error: error?.message ?? 'sign_failed' }, 400);

    return json({ url: data.signedUrl, expiresIn: TTL_SECONDS });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'unexpected_error' }, 500);
  }
});
