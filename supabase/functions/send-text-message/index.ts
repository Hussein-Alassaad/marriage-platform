// Edge Function: send-text-message
// Clients can NEVER insert messages — only this function (service role) may,
// after moderation. Enforces stage rules (Decisions Part D) and the introduction
// per-person quota (from settings).
//
// Moderation is two layers:
//   1) A fast, evasion-resistant local pre-filter (no key needed). It normalizes
//      leetspeak, spacing, repeated letters and chat abbreviations before matching,
//      so "l0ve  u", "luv u", "ily", "i n s t a g r a m" are all caught.
//   2) An AI moderator (Claude) that semantically judges the message against the
//      stage rules — this is what catches the *attempts* a wordlist can't enumerate
//      (hinting at a handle, roundabout romance, coded contact sharing).
//
// FAIL-CLOSED: if the AI moderator is configured but errors/times out, the message
// is NOT sent. We never "fail open for better UX".
//
// Secrets: set ANTHROPIC_API_KEY as an Edge Function secret. It never touches the
// frontend and is never committed:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// Deploy: supabase functions deploy send-text-message

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk@0.68.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

/* ------------------------------------------------------------------ */
/* Layer 1 — evasion-resistant local pre-filter                        */
/* ------------------------------------------------------------------ */

// Contact info + romance are forbidden until the Family stage (Part D).
const PRE_FAMILY = new Set(['introduction', 'serious_communication']);

const PROFANITY = ['fuck', 'fucking', 'fuk', 'fck', 'shit', 'bitch', 'asshole', 'ass', 'cunt', 'dick', 'pussy', 'bastard', 'slut', 'whore', 'piss', 'motherfucker'];
const SEXUAL = ['sex', 'sexy', 'nude', 'nudes', 'naked', 'horny', 'boobs', 'porn', 'xxx', 'hookup', 'sext'];
const ROMANTIC = [
  'i love you', 'love you', 'love u', 'luv you', 'luv u', 'ily', 'ilu', 'ilysm',
  'in love with you', 'my love', 'my heart', 'my queen', 'my king',
  'babe', 'baby', 'sweetheart', 'sweetie', 'honey', 'darling', 'cutie', 'gorgeous',
  'kiss', 'kisses', 'hug you', 'miss you', 'miss u', 'marry me', 'xoxo',
  'beautiful eyes', 'you are beautiful', 'ur beautiful', 'you are gorgeous',
];
// Social platforms / handle sharing — all forbidden before Family.
const PLATFORMS = [
  'instagram', 'insta', 'ig', 'snapchat', 'snap', 'whatsapp', 'whats app', 'wa',
  'telegram', 'tg', 'tiktok', 'facebook', 'fb', 'messenger', 'twitter', 'x com',
  'discord', 'skype', 'viber', 'signal', 'linkedin', 'youtube', 'email', 'gmail', 'phone', 'number',
];
const CONTACT_PHRASES = [
  'add me', 'dm me', 'text me', 'call me', 'find me on', 'my handle', 'my username',
  'my account is', 'my number is', 'my name on', 'reach me on', 'message me on',
  'lets talk on', 'let us talk on', 'here is my', 'follow me',
];

const EMAIL_RE = /[a-z0-9._%+-]+\s*(?:@|\(at\)|\[at\]|\sat\s)\s*[a-z0-9.-]+\s*(?:\.|\(dot\)|\sdot\s)\s*[a-z]{2,}/i;
const HANDLE_RE = /(^|[\s(])@[a-z0-9._]{3,}/i;
const URL_RE = /(https?:\/\/|www\.)\S+/i;

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i', '|': 'i' };
const ABBREV: Record<string, string> = { u: 'you', ur: 'your', r: 'are', luv: 'love', lov: 'love', b: 'be', pls: 'please', plz: 'please', bby: 'baby', bae: 'babe' };

/** Word-level normalization: strips accents, leetspeak, punctuation; expands chat shorthand. */
function normalize(input: string): string {
  const deaccented = input.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const deleet = [...deaccented].map((c) => LEET[c] ?? c).join('');
  const words = deleet
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    // collapse stretched letters: "loooove" -> "loove" (keeps real doubles)
    .map((w) => w.replace(/(.)\1{2,}/g, '$1$1'))
    .map((w) => ABBREV[w] ?? w);
  return ` ${words.join(' ')} `;
}

/** All separators removed — defeats "i n s t a g r a m" and "l.o.v.e.u". */
function squash(input: string): string {
  return normalize(input).replace(/[^a-z0-9]/g, '');
}

const hasWord = (norm: string, words: string[]) => words.some((w) => norm.includes(` ${w} `));
const hasPhrase = (norm: string, sq: string, phrases: string[]) =>
  phrases.some((p) => norm.includes(` ${p} `) || sq.includes(p.replace(/[^a-z0-9]/g, '')));

function digitCount(s: string) {
  return (s.match(/\d/g) ?? []).length;
}

function prefilter(text: string, stage: string): { category: string; reason: string } | null {
  const norm = normalize(text);
  const sq = squash(text);

  if (hasWord(norm, PROFANITY) || hasWord(norm, SEXUAL)) {
    return { category: 'inappropriate', reason: 'profanity_or_sexual' };
  }
  if (!PRE_FAMILY.has(stage)) return null;

  if (EMAIL_RE.test(text) || URL_RE.test(text) || HANDLE_RE.test(text)) {
    return { category: 'contact_info', reason: 'email_url_or_handle' };
  }
  // A run of 7+ digits anywhere (spaces/dashes/dots stripped) is a phone number.
  if (/\d[\d\s.\-()]{5,}\d/.test(text) && digitCount(text) >= 7) {
    return { category: 'contact_info', reason: 'phone_number' };
  }
  if (hasWord(norm, PLATFORMS) || hasPhrase(norm, sq, PLATFORMS) || hasPhrase(norm, sq, CONTACT_PHRASES)) {
    return { category: 'contact_info', reason: 'platform_or_handle_sharing' };
  }
  if (hasPhrase(norm, sq, ROMANTIC)) {
    return { category: 'too_soon', reason: 'premature_romance' };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Layer 2 — AI moderator (Claude)                                     */
/* ------------------------------------------------------------------ */

const MODEL = 'claude-opus-4-8';
const PROMPT_VERSION = 'mithaq-mod-v1';
const POLICY_VERSION = 'partD-v3';

const SYSTEM = `You are the moderation gate for Mithaq, an Islamic marriage platform (NOT a dating app). Couples progress through supervised stages: introduction -> serious_communication -> family -> married.

You judge ONE message from one participant. Be STRICT and treat every attempt to work around the rules as a violation, including misspellings, abbreviations, spacing tricks, leetspeak, transliteration, emoji substitution, other languages (Arabic, Franco-Arabic/Arabizi, etc.), coded hints, and anything phrased as a question or a joke. Intent counts, not literal wording: "how can I reach you outside this app?" and "my name on the app with the camera logo is X" are both contact sharing.

Block the message if ANY of these apply:

1. contact_info — the sender shares, hints at, or asks for any way to communicate off-platform, at the "introduction" or "serious_communication" stage. This covers phone numbers, emails, links, usernames/handles, and any social or messaging platform (Instagram, Snapchat, WhatsApp, Telegram, TikTok, Facebook, Discord, X/Twitter, etc.), however obliquely referenced — including "add me", "find me", "same name there", or spelling a handle out. Contact info is ONLY permitted at the "family" and "married" stages.

2. too_soon — romantic, flirtatious, or physically intimate language before the "family" stage: declarations of love ("love you", "love u", "ily"), pet names (babe, baby, honey, darling, sweetheart), compliments on the body or appearance beyond ordinary courtesy, talk of kissing/touching/missing them, or excessive emotional intensity inappropriate for a supervised introduction.

3. inappropriate — sexual content, profanity, insults, harassment, threats, hate speech, or anything degrading.

4. haram_meeting — proposing a private, unchaperoned meeting or call before the family stage.

5. scam — requests for money, financial details, external payments, or off-platform "verification".

Otherwise allow. Respectful getting-to-know-you conversation about faith, values, family, education, work, and marriage goals is exactly what this stage is for — do not block it.

Return ONLY the JSON object. No prose.`;

const SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['allowed', 'blocked'] },
    category: {
      type: 'string',
      enum: ['none', 'contact_info', 'too_soon', 'inappropriate', 'haram_meeting', 'scam'],
    },
    reason: { type: 'string', description: 'Short explanation, max 15 words.' },
  },
  required: ['verdict', 'category', 'reason'],
  additionalProperties: false,
} as const;

type Verdict = { verdict: 'allowed' | 'blocked'; category: string; reason: string };

async function aiModerate(client: Anthropic, text: string, stage: string): Promise<Verdict> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 200,
    system: SYSTEM,
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: SCHEMA },
    },
    messages: [
      {
        role: 'user',
        content: `Journey stage: ${stage}\n\nMessage to moderate:\n"""\n${text}\n"""`,
      },
    ],
  });

  const block = response.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') throw new Error('moderator_no_output');
  return JSON.parse(block.text) as Verdict;
}

/* ------------------------------------------------------------------ */

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

    const audit = (row: Record<string, unknown>) =>
      admin.from('message_moderation').insert({
        conversation_id: conversationId,
        sender_id: uid,
        stage,
        policy_version: POLICY_VERSION,
        ...row,
      });

    // Layer 1: local pre-filter (instant, no network).
    const pre = prefilter(text, stage);
    if (pre) {
      await audit({
        verdict: 'blocked',
        category: pre.category,
        original_text: text,
        provider: 'local',
        model: 'prefilter',
        prompt_version: 'prefilter-v2',
      });
      return json({ blocked: true, category: pre.category });
    }

    // Layer 2: AI moderator. Fail-closed — configured but broken means nothing sends.
    let provider = 'local';
    let model = 'prefilter';
    let promptVersion = 'prefilter-v2';
    if (anthropicKey) {
      provider = 'anthropic';
      model = MODEL;
      promptVersion = PROMPT_VERSION;
      const anthropic = new Anthropic({ apiKey: anthropicKey, maxRetries: 1, timeout: 15_000 });
      let verdict: Verdict;
      try {
        verdict = await aiModerate(anthropic, text, stage);
      } catch (err) {
        await audit({
          verdict: 'blocked',
          category: 'unavailable',
          original_text: text,
          provider,
          model,
          prompt_version: promptVersion,
        });
        console.error('moderation_unavailable', err);
        return json({ blocked: true, category: 'unavailable' });
      }
      if (verdict.verdict === 'blocked') {
        await audit({
          verdict: 'blocked',
          category: verdict.category,
          original_text: text,
          provider,
          model,
          prompt_version: promptVersion,
        });
        return json({ blocked: true, category: verdict.category });
      }
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
      audit({ message_id: message.id, verdict: 'allowed', provider, model, prompt_version: promptVersion }),
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
