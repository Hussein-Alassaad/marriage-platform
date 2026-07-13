// Edge Function: suggest-questions
// The AI suggests what to ask next — the hardest part of a supervised introduction is
// knowing how to start, and "salam" followed by silence is how good matches die.
//
// Suggestions are stage-aware (Decisions Part D) and grounded in what the two people
// have already said, so they move the conversation forward instead of repeating it.
//
// This is a SUGGESTION surface, not a delivery surface, so it deliberately does NOT
// fail closed: if the AI is unavailable the function returns an empty list and the
// client falls back to a curated set. A suggestion is never a bypass — clicking one
// only fills the composer, and sending it still goes through the full moderation gate
// like anything the user typed themselves.
//
// Action (JSON body): { matchId, locale } → { suggestions: string[] }
//
// Deploy: `supabase functions deploy suggest-questions`.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk@0.68.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

const MODEL = Deno.env.get('MODERATION_MODEL') ?? 'claude-opus-4-8';
const FALLBACK_MODELS = ['claude-sonnet-5', 'claude-haiku-4-5'];

/** What each stage is FOR — the suggestions should serve that, not wander past it. */
const STAGE_GUIDE: Record<string, string> = {
  introduction:
    'They have just connected. This stage is for establishing whether marriage is plausible at all: values, religious practice, family, education, work, and what each of them wants from marriage. Contact details, romance and flirtation are forbidden. Keep questions straightforward and easy to answer.',
  serious_communication:
    'They have both chosen to continue, so the conversation should go deeper: expectations of a spouse, finances, children and parenting, where they would live, careers after marriage, conflict resolution, extended family. Contact details and romance are still forbidden — the families are not involved yet.',
  family:
    'Their families are now involved and a guardian is present. Questions may cover practical marriage planning: meeting the families, the mahr and the wedding, housing, timelines, and involving their parents. Contact details and meeting arrangements are permitted now.',
  married:
    'They are married. Suggestions should support building a life together: shared goals, finances, family planning, and communication.',
};

function personLine(p: Record<string, unknown> | null, label: string): string {
  if (!p) return `${label}: (no profile)`;
  const bits = [
    p.gender ? `gender: ${p.gender}` : null,
    p.country || p.city ? `lives in: ${[p.city, p.country].filter(Boolean).join(', ')}` : null,
    p.education_level ? `education: ${p.education_level}` : null,
    p.occupation ? `work: ${p.occupation}` : null,
    p.marriage_goals ? `marriage goals: ${JSON.stringify(p.marriage_goals)}` : null,
    p.bio ? `about: ${String(p.bio).slice(0, 300)}` : null,
  ].filter(Boolean);
  return `${label} (${p.display_name ?? 'unnamed'}): ${bits.join(' · ') || 'no details shared'}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  const authHeader = req.headers.get('Authorization') ?? '';

  const asUser = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData } = await asUser.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return json({ error: 'unauthorized' }, 401);

  const { matchId, locale } = await req.json().catch(() => ({}));
  if (!matchId) return json({ error: 'match_required' }, 400);
  // No key ⇒ no suggestions. The client shows its curated fallback set.
  if (!anthropicKey) return json({ suggestions: [] });

  const admin = createClient(url, serviceKey);

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
    if (!STAGE_GUIDE[stage]) return json({ suggestions: [] });

    const otherId = match.user_a === uid ? match.user_b : match.user_a;
    const [{ data: profiles }, { data: conv }] = await Promise.all([
      admin
        .from('profiles')
        .select('id, display_name, gender, country, city, education_level, occupation, marriage_goals, bio')
        .in('id', [uid, otherId]),
      admin
        .from('conversations')
        .select('id')
        .eq('match_id', matchId)
        .eq('kind', 'direct')
        .is('deleted_at', null)
        .maybeSingle(),
    ]);

    const byId = new Map(((profiles ?? []) as Record<string, unknown>[]).map((p) => [String(p.id), p]));
    const me = byId.get(uid) ?? null;
    const them = byId.get(otherId) ?? null;

    // Recent history so the AI doesn't suggest something already asked and answered.
    let history = '(no messages yet — this is the very first message)';
    if (conv) {
      const { data: messages } = await admin
        .from('messages')
        .select('sender_id, type, body, transcript')
        .eq('conversation_id', conv.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(14);
      const lines = (messages ?? [])
        .reverse()
        .map((m: { sender_id: string; type: string; body: string | null; transcript: string | null }) => {
          const who = m.sender_id === uid ? 'ME' : 'THEM';
          const text = m.type === 'text' ? m.body : (m.transcript ?? `[${m.type}]`);
          return text ? `${who}: ${text}` : null;
        })
        .filter(Boolean);
      if (lines.length) history = lines.join('\n');
    }

    const language =
      String(locale ?? 'en').startsWith('ar')
        ? 'Arabic (Modern Standard Arabic, warm and natural)'
        : 'English';

    const system = `You help a member of Mithaq, an Islamic marriage platform (NOT a dating app), decide what to say next to the person they have matched with. You are writing FOR the member — each suggestion is a message they could send as-is.

Current stage: ${stage}.
${STAGE_GUIDE[stage]}

Write 4 suggestions. Rules:
- Write in ${language}. Write them in the first person, exactly as the member would send them.
- Each is ONE short message: a single question, or a brief statement plus a question. Maximum 25 words.
- Ground them in the two profiles and in what has ALREADY been said. Never suggest something they have already asked or answered. If a topic was raised, go one level deeper into it instead of restarting.
- Respectful, sincere, marriage-focused. This is a supervised conversation between two people evaluating each other for marriage, with families in mind.
- Vary them: do not give four versions of the same question.
- NEVER suggest sharing or asking for phone numbers, emails, social media, or any off-platform contact, and never anything romantic, flirtatious, physical, or overly familiar${stage === 'family' || stage === 'married' ? '' : ' — at this stage those are forbidden and would be blocked'}.
- If the conversation has not started, make the first suggestion a warm, natural opener (a greeting plus one genuine question).

Respond with exactly this JSON and nothing else:
{"suggestions": ["...", "...", "...", "..."]}`;

    const user = `${personLine(me, 'ME')}
${personLine(them, 'THEM')}

Recent conversation (oldest first):
${history}`;

    const client = new Anthropic({ apiKey: anthropicKey, maxRetries: 1, timeout: 20_000 });
    for (const model of [MODEL, ...FALLBACK_MODELS]) {
      try {
        const response = await client.messages.create({
          model,
          max_tokens: 600,
          system,
          messages: [{ role: 'user', content: user }],
        });
        const block = response.content.find((b) => b.type === 'text');
        if (!block || block.type !== 'text') continue;
        const start = block.text.indexOf('{');
        const end = block.text.lastIndexOf('}');
        if (start === -1 || end <= start) continue;
        const parsed = JSON.parse(block.text.slice(start, end + 1)) as { suggestions?: unknown };
        const suggestions = Array.isArray(parsed.suggestions)
          ? parsed.suggestions.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).slice(0, 4)
          : [];
        if (suggestions.length) return json({ suggestions });
      } catch (err) {
        console.error('suggest_failed', model, err instanceof Error ? err.message : String(err));
      }
    }

    // Suggestions are a convenience, not a gate — degrade quietly to the client's set.
    return json({ suggestions: [] });
  } catch (e) {
    console.error('suggest_error', e instanceof Error ? e.message : String(e));
    return json({ suggestions: [] });
  }
});
