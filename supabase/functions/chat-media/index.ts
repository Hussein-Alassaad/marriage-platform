// Edge Function: chat-media
// The chat-voice / chat-images / chat-videos buckets have NO client policies —
// privacy is enforced by which file the server hands you. This function is that
// server: it verifies the caller is a participant of the message's conversation,
// then issues a short-lived signed URL for exactly that one file.
//
// Actions (JSON body):
//   { messageId }                    → { url, expiresIn }   (participants)
//   { action: 'pending-media' }      → videos awaiting human review (admin)
//   { action: 'review-media', ... }  → approve / reject one (admin)
//
// No model can watch a video, so videos land as `media_status = 'pending'` and are
// NOT signable until a human approves them. That check lives here: this function
// refuses to sign anything that is not `approved`, which is what makes "deliver only
// after approval" (Part D §5) true rather than aspirational.
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
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? '');
  const messageId = body.messageId as string | undefined;

  const isAdmin = async () => {
    const { data } = await admin.from('user_roles').select('role').eq('user_id', uid);
    return (data ?? []).some((r: { role: string }) => r.role === 'admin');
  };

  try {
    // ── Admin: the human review queue for videos ────────────────────────────
    if (action === 'pending-media') {
      if (!(await isAdmin())) return json({ error: 'forbidden' }, 403);
      const { data: messages } = await admin
        .from('messages')
        .select('id, conversation_id, sender_id, type, media_path, created_at')
        .eq('media_status', 'pending')
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(50);

      const senderIds = (messages ?? []).map((m: { sender_id: string }) => m.sender_id);
      const { data: profs } = await admin.from('profiles').select('id, display_name').in('id', senderIds);
      const nameById = new Map(
        ((profs ?? []) as { id: string; display_name: string | null }[]).map((p) => [p.id, p.display_name]),
      );

      const rows = await Promise.all(
        (messages ?? []).map(async (m: Record<string, unknown>) => {
          const bucket = BUCKET[String(m.type)];
          const { data } = await admin.storage.from(bucket).createSignedUrl(String(m.media_path), TTL_SECONDS);
          return {
            id: m.id,
            type: m.type,
            senderName: nameById.get(String(m.sender_id)) ?? null,
            createdAt: m.created_at,
            url: data?.signedUrl ?? null,
          };
        }),
      );
      return json({ media: rows });
    }

    if (action === 'review-media') {
      if (!(await isAdmin())) return json({ error: 'forbidden' }, 403);
      const decision = String(body.decision ?? '');
      const id = String(body.messageId ?? '');
      if (decision !== 'approved' && decision !== 'rejected') return json({ error: 'bad_decision' }, 400);

      const { data: message } = await admin
        .from('messages')
        .select('id, conversation_id, sender_id, type, media_path, media_status')
        .eq('id', id)
        .maybeSingle();
      if (!message || message.media_status !== 'pending') return json({ error: 'not_pending' }, 409);

      await admin.from('messages').update({ media_status: decision }).eq('id', id);

      // A rejected video is removed from storage — we don't keep what we won't show.
      if (decision === 'rejected' && message.media_path) {
        const bucket = BUCKET[message.type as string];
        if (bucket) await admin.storage.from(bucket).remove([message.media_path]);
      }

      await admin.from('audit_logs').insert({
        actor_id: uid,
        action: `media.${decision}`,
        entity_type: 'message',
        entity_id: id,
        reason: typeof body.reason === 'string' ? body.reason.slice(0, 300) : null,
      });
      return json({ ok: true, status: decision });
    }

    // ── Participant: a signed URL for one approved file ─────────────────────
    if (!messageId) return json({ error: 'message_required' }, 400);

    const { data: message } = await admin
      .from('messages')
      .select('id, conversation_id, type, media_path, media_status, deleted_at')
      .eq('id', messageId)
      .maybeSingle();
    if (!message || message.deleted_at || !message.media_path) return json({ error: 'not_found' }, 404);
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
