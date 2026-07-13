// Edge Function: send-text-message
// Clients can NEVER insert messages — only this function (service role) may,
// after moderation. Enforces stage rules (Decisions Part D) and the introduction
// per-person quota (from settings).
//
// Moderation lives in ../_shared/moderation.ts and is shared with the voice sender:
// an evasion-resistant local pre-filter plus an AI moderator (Claude) that judges
// intent. FAIL-CLOSED — if the moderator is configured but unreachable, nothing sends.
//
// Secrets: set ANTHROPIC_API_KEY as an Edge Function secret. It never touches the
// frontend and is never committed:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// Deploy: supabase functions deploy send-text-message

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { moderate, POLICY_VERSION } from '../_shared/moderation.ts';
import { secret } from '../_shared/env.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

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

    // Pre-filter + AI moderator (fail-closed).
    const verdict = await moderate(text, stage, anthropicKey);
    if (verdict.blocked) {
      await audit({
        verdict: 'blocked',
        category: verdict.category,
        original_text: text,
        provider: verdict.provider,
        model: verdict.model,
        prompt_version: verdict.promptVersion,
      });
      // `detail` is only present when the moderator itself failed — it tells you
      // whether the key, the model access, or the network is the problem.
      return json({ blocked: true, category: verdict.category, detail: verdict.detail });
    }

    // Introduction per-person quota — read cap + counter once, in parallel.
    const intro = stage === 'introduction';
    let cap = 0;
    let sent = 0;
    if (intro) {
      const [{ data: setting }, { data: counter }] = await Promise.all([
        admin.from('settings').select('value').eq('key', 'intro_messages_per_person').maybeSingle(),
        admin
          .from('message_counters')
          .select('sent_count')
          .eq('conversation_id', conversationId)
          .eq('user_id', uid)
          .maybeSingle(),
      ]);
      cap = Number(setting?.value ?? 10) || 10;
      sent = counter?.sent_count ?? 0;
      if (sent >= cap) return json({ blocked: true, category: 'quota', remaining: 0 });
    }

    // Insert the message (the stage-rules trigger is the last line of defense).
    const { data: message, error: mErr } = await admin
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: uid, type: 'text', body: text })
      .select('id, created_at')
      .single();
    if (mErr) return json({ error: mErr.message }, 400);

    // Audit + counter + conversation touch run together (don't serialize).
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
    if (intro) {
      after.push(
        admin
          .from('message_counters')
          .upsert({ conversation_id: conversationId, user_id: uid, sent_count: sent + 1 }, { onConflict: 'conversation_id,user_id' }),
      );
      remaining = Math.max(0, cap - (sent + 1));
    }
    await Promise.all(after);
    return json({ ok: true, conversationId, messageId: message.id, remaining });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'unexpected_error' }, 500);
  }
});
