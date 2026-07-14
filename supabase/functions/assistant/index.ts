// Edge Function: assistant (Marriage Assistant)
//
// The one feature with no key-free fallback. Moderation has a pre-filter; suggestions have
// a curated list; an assistant with no model has nothing to say. So with no key it returns
// `assistant_unavailable` and the UI shows an honest "not yet" — never a chat box that
// answers every question with an error.
//
// PRIVACY IS THE WHOLE DESIGN HERE:
//   • The assistant reads ONLY the requesting member's own data. It is never given the
//     other person's profile, their messages, or their finances — asking it "what did she
//     say about children?" must fail because the information was never in the context, not
//     because a prompt told it to decline. A refusal you can argue with is not a boundary.
//   • Admins cannot read these chats. There is no policy on the table that would let them.
//   • Memory is consent-based: it is written only when the member has it on, and they can
//     delete it themselves without asking the server.
//
// Guidance mode is Islamic by default: the assistant speaks within an Islamic frame and
// REFUSES to issue religious rulings — it points to a scholar. An AI fatwa is exactly the
// harm this platform must not cause.
//
// Actions: chats | messages | send | new | delete-chat | memory | forget
//
// Deploy: `supabase functions deploy assistant`.

import Anthropic from 'npm:@anthropic-ai/sdk@0.68.0';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { secret } from '../_shared/env.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

const MODEL = 'claude-opus-4-8';
const MAX_TOKENS = 1024;
const HISTORY_LIMIT = 20; // messages of context — enough to hold a thread, cheap to send

async function setting<T>(admin: SupabaseClient, key: string, fallback: T): Promise<T> {
  const { data } = await admin.from('settings').select('value').eq('key', key).maybeSingle();
  return (data?.value ?? fallback) as T;
}

/**
 * The system prompt. Two things it must do that a shorter prompt would not:
 * refuse to give religious rulings (an AI fatwa is a real harm), and refuse to help
 * anyone route around the platform's safety rules — a member who cannot get a phone
 * number past the moderator must not be able to ask the assistant for a workaround.
 */
function systemPrompt(
  locale: string,
  guidance: string,
  profile: Record<string, unknown> | null,
  stage: string | null,
): string {
  const islamic = guidance !== 'general';
  const lines = [
    'You are the Marriage Assistant for Mithaq, an Islamic marriage platform. You help one member — the person you are speaking to — prepare for a serious, respectful marriage.',
    '',
    'WHAT YOU HELP WITH: preparing for marriage; what to ask and discuss at each stage; understanding a compatibility result; improving their own profile; talking with their family or guardian; planning a wedding within their means; and how this platform works.',
    '',
    'HARD RULES:',
    '- You are speaking to ONE person. You have never seen the other person\'s profile, messages, or finances, and you must say so plainly if asked. Do not speculate about what the other person thinks, said, or feels.',
    '- You do NOT issue religious rulings (fatwa). For any question of what is permitted or forbidden in Islam, give the general, widely-agreed framing if there is one, and tell them to ask a qualified local scholar. Never invent a ruling and never pick a side in a scholarly disagreement.',
    '- You do NOT help anyone bypass the platform\'s rules. If asked how to share contact details before the Family stage, how to get around message moderation, or how to meet privately before it is appropriate, decline and explain why the rule exists.',
    '- You are not a lawyer, doctor, or therapist. For legal, medical, or mental-health matters, say so and point to a professional. If someone is in danger or describes abuse, tell them plainly to contact local emergency services or a trusted person immediately.',
    '- Never invent facts about this member, their match, or the platform. If you do not know, say you do not know.',
    '',
    islamic
      ? 'FRAME: Speak within an Islamic frame — marriage as a covenant (mithaq), modesty, family involvement, and the guardian\'s role are normal and assumed. Be warm and practical, never preachy, and never judgemental about where someone is in their practice.'
      : 'FRAME: Speak respectfully and practically about marriage, without assuming a particular religious practice.',
    '',
    locale === 'ar'
      ? 'Reply in Arabic, in natural Modern Standard Arabic — not a translation of English phrasing.'
      : 'Reply in English.',
    'Be concise: a few short paragraphs at most, unless they ask for detail.',
  ];

  if (profile) {
    // Only their OWN profile. This is the entire context they get about a human being.
    lines.push('', 'ABOUT THE MEMBER YOU ARE SPEAKING TO (their own profile — use it, do not recite it back):', JSON.stringify(profile));
  }
  if (stage) {
    lines.push('', `They currently have a connection at the "${stage}" stage of the journey.`);
  }
  return lines.join('\n');
}

/** Daily limit by tier. 0 (or an unset Plus value) means unlimited. */
async function dailyLimit(admin: SupabaseClient, tier: string): Promise<number> {
  if (tier === 'marriage_plus') return Number(await setting(admin, 'assistant_daily_marriage_plus', 0));
  if (tier === 'serious') return Number(await setting(admin, 'ai_daily_conversations_serious', 50));
  return Number(await setting(admin, 'ai_daily_conversations_free', 5));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const apiKey = secret('ANTHROPIC_API_KEY');
  const authHeader = req.headers.get('Authorization') ?? '';

  const asUser = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData } = await asUser.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(url, serviceKey);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? '');

  try {
    if (action === 'chats') {
      const { data } = await admin
        .from('assistant_chats')
        .select('id, title, updated_at')
        .eq('user_id', uid)
        .order('updated_at', { ascending: false })
        .limit(30);

      // Also report how much of today's allowance is left, so the UI never invites
      // someone to start a conversation the server is about to refuse.
      const { data: profile } = await admin.from('profiles').select('subscription_tier').eq('id', uid).maybeSingle();
      const tier = profile?.subscription_tier ?? 'free';
      const limit = await dailyLimit(admin, tier);
      const today = new Date().toISOString().slice(0, 10);
      const { count } = await admin
        .from('assistant_chats')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', uid)
        .gte('created_at', `${today}T00:00:00Z`);

      return json({
        chats: data ?? [],
        limit,
        usedToday: count ?? 0,
        enabled: Boolean(apiKey) && (await setting(admin, 'assistant_enabled', false)),
      });
    }

    if (action === 'messages') {
      const chatId = String(body.chatId ?? '');
      if (!chatId) return json({ error: 'chat_required' }, 400);
      const { data: chat } = await admin.from('assistant_chats').select('user_id').eq('id', chatId).maybeSingle();
      if (!chat || chat.user_id !== uid) return json({ error: 'not_found' }, 404);

      const { data } = await admin
        .from('assistant_messages')
        .select('id, role, content, created_at')
        .eq('chat_id', chatId)
        .order('created_at');
      return json({ messages: data ?? [] });
    }

    if (action === 'send') {
      const enabled = await setting(admin, 'assistant_enabled', false);
      if (!enabled || !apiKey) return json({ error: 'assistant_unavailable' }, 503);

      const text = String(body.text ?? '').trim();
      if (!text) return json({ error: 'empty' }, 400);
      if (text.length > 4000) return json({ error: 'too_long' }, 400);
      const locale = String(body.locale ?? 'en');

      const { data: profile } = await admin
        .from('profiles')
        .select(
          'display_name, dob, gender, country, city, education_level, occupation, marriage_goals, lifestyle, family_values, financial_readiness, subscription_tier, verification_status',
        )
        .eq('id', uid)
        .maybeSingle();
      const tier = profile?.subscription_tier ?? 'free';

      let chatId = String(body.chatId ?? '');

      // A NEW conversation is what counts against the daily limit (the PRD counts
      // conversations, not messages) — so continuing an existing thread is never blocked
      // halfway through, which would be a cruel place to stop someone.
      if (!chatId) {
        const limit = await dailyLimit(admin, tier);
        if (limit > 0) {
          const today = new Date().toISOString().slice(0, 10);
          const { count } = await admin
            .from('assistant_chats')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', uid)
            .gte('created_at', `${today}T00:00:00Z`);
          if ((count ?? 0) >= limit) return json({ error: 'daily_limit', limit }, 429);
        }

        const { data: created, error } = await admin
          .from('assistant_chats')
          .insert({ user_id: uid, title: text.slice(0, 60) })
          .select('id')
          .single();
        if (error) return json({ error: error.message }, 400);
        chatId = created.id;
      } else {
        const { data: chat } = await admin.from('assistant_chats').select('user_id').eq('id', chatId).maybeSingle();
        if (!chat || chat.user_id !== uid) return json({ error: 'not_found' }, 404);
      }

      // Their journey stage — the assistant's advice at "introduction" is not its advice
      // at "family". Only the stage; never the other person's identity or words.
      const { data: match } = await admin
        .from('matches')
        .select('stage')
        .or(`user_a.eq.${uid},user_b.eq.${uid}`)
        .is('deleted_at', null)
        .not('stage', 'in', '("terminated")')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: history } = await admin
        .from('assistant_messages')
        .select('role, content')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(HISTORY_LIMIT);

      const priorTurns = ((history ?? []) as { role: string; content: string }[])
        .reverse()
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      await admin.from('assistant_messages').insert({ chat_id: chatId, role: 'user', content: text });

      const guidance = String(await setting(admin, 'assistant_guidance_mode', 'islamic'));
      const started = Date.now();

      let reply: string;
      try {
        const client = new Anthropic({ apiKey });
        const response = await client.messages.create({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: systemPrompt(locale, guidance, profile ?? null, match?.stage ?? null),
          messages: [...priorTurns, { role: 'user', content: text }],
        });
        reply = response.content
          .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
          .map((block) => block.text)
          .join('\n')
          .trim();

        await admin.from('ai_requests').insert({
          user_id: uid,
          feature: 'marriage_assistant',
          provider: 'anthropic',
          model: MODEL,
          latency_ms: Date.now() - started,
          prompt_tokens: response.usage?.input_tokens ?? null,
          completion_tokens: response.usage?.output_tokens ?? null,
          total_tokens: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
          status: 'ok',
        });
      } catch (e) {
        await admin.from('ai_requests').insert({
          user_id: uid,
          feature: 'marriage_assistant',
          provider: 'anthropic',
          model: MODEL,
          latency_ms: Date.now() - started,
          status: 'error',
        });
        const detail = e instanceof Error ? e.message : 'unknown';
        return json({ error: 'assistant_failed', detail }, 503);
      }

      if (!reply) return json({ error: 'assistant_failed', detail: 'empty reply' }, 503);

      const { data: saved } = await admin
        .from('assistant_messages')
        .insert({ chat_id: chatId, role: 'assistant', content: reply })
        .select('id, role, content, created_at')
        .single();

      await admin.from('assistant_chats').update({ updated_at: new Date().toISOString() }).eq('id', chatId);

      return json({ chatId, message: saved });
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'unexpected_error' }, 500);
  }
});
