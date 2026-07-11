// Edge Function: send-text-message
// Clients can NEVER insert messages — only this function (service role) may,
// after moderation. Enforces stage rules (introduction = text only; no messaging
// in interest_sent/terminated — also guarded by a DB trigger) and the
// introduction per-person quota (from settings). Fail-closed by design.
//
// Moderation here is key-free but principled (Decisions Part D): contact info is
// blocked before the Family stage. A real AI moderator can layer on top later,
// writing the same message_moderation record with provider/model/versions.
//
// Deploy: `supabase functions deploy send-text-message`.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_RE = /\+?\d[\d\s-]{6,}\d/;
const CONTACT_STAGES = new Set(['introduction', 'serious_communication']);

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
  const { matchId, body } = await req.json().catch(() => ({}));
  const text = typeof body === 'string' ? body.trim() : '';
  if (!matchId) return json({ error: 'match_required' }, 400);
  if (!text) return json({ error: 'empty' }, 400);
  if (text.length > 2000) return json({ error: 'too_long' }, 400);

  try {
    // Match must exist, be active, and include the sender.
    const { data: match } = await admin
      .from('matches')
      .select('id, user_a, user_b, stage, deleted_at')
      .eq('id', matchId)
      .maybeSingle();
    if (!match || match.deleted_at || (match.user_a !== uid && match.user_b !== uid)) {
      return json({ error: 'not_a_participant' }, 403);
    }
    const stage = match.stage as string;
    if (stage === 'interest_sent' || stage === 'terminated') {
      return json({ error: 'stage_not_allowed' }, 409);
    }

    // Ensure the conversation + participants exist for this match.
    let conversationId: string;
    const { data: conv } = await admin
      .from('conversations')
      .select('id')
      .eq('match_id', matchId)
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

    // Moderation (key-free, Part D): block contact info before the Family stage.
    if (CONTACT_STAGES.has(stage) && (EMAIL_RE.test(text) || PHONE_RE.test(text))) {
      await admin.from('message_moderation').insert({
        conversation_id: conversationId,
        sender_id: uid,
        verdict: 'blocked',
        category: 'contact_info',
        original_text: text,
        stage,
        provider: 'local',
        policy_version: 'partD-v1',
      });
      return json({ blocked: true, category: 'contact_info' });
    }

    // Introduction per-person quota (delivered messages only).
    if (stage === 'introduction') {
      const { data: setting } = await admin
        .from('settings')
        .select('value')
        .eq('key', 'intro_messages_per_person')
        .maybeSingle();
      const cap = Number(setting?.value ?? 10) || 10;
      const { data: counter } = await admin
        .from('message_counters')
        .select('sent_count')
        .eq('conversation_id', conversationId)
        .eq('user_id', uid)
        .maybeSingle();
      const sent = counter?.sent_count ?? 0;
      if (sent >= cap) return json({ blocked: true, category: 'quota', remaining: 0 });
    }

    // Insert the message (the stage-rules trigger is the last line of defense).
    const { data: message, error: mErr } = await admin
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: uid, type: 'text', body: text })
      .select('id, created_at')
      .single();
    if (mErr) return json({ error: mErr.message }, 400);

    await admin.from('message_moderation').insert({
      message_id: message.id,
      conversation_id: conversationId,
      sender_id: uid,
      verdict: 'allowed',
      stage,
      provider: 'local',
      policy_version: 'partD-v1',
    });

    let remaining: number | null = null;
    if (stage === 'introduction') {
      const { data: setting } = await admin
        .from('settings')
        .select('value')
        .eq('key', 'intro_messages_per_person')
        .maybeSingle();
      const cap = Number(setting?.value ?? 10) || 10;
      const { data: counter } = await admin
        .from('message_counters')
        .select('sent_count')
        .eq('conversation_id', conversationId)
        .eq('user_id', uid)
        .maybeSingle();
      const next = (counter?.sent_count ?? 0) + 1;
      await admin
        .from('message_counters')
        .upsert({ conversation_id: conversationId, user_id: uid, sent_count: next }, { onConflict: 'conversation_id,user_id' });
      remaining = Math.max(0, cap - next);
    }

    await admin.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
    return json({ ok: true, conversationId, messageId: message.id, remaining });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'unexpected_error' }, 500);
  }
});
