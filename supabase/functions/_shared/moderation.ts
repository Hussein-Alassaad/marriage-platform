// Shared moderation (Decisions Part D) — used by every send-*-message function.
// Text and voice transcripts go through exactly the same gate; the only difference
// is where the words came from.
//
// Two layers:
//   1) An evasion-resistant local pre-filter (instant, no network). It normalizes
//      accents, leetspeak, stretched letters, separators and chat shorthand BEFORE
//      matching, so "l0ve  u", "luv u", "ily" and "i n s t a g r a m" are all caught.
//   2) An AI moderator (Claude) that judges intent — the attempts a wordlist can
//      never enumerate (hinting at a handle, roundabout romance, coded contact).
//
// FAIL-CLOSED: if the AI moderator is configured but errors or times out, the
// message is NOT delivered. We never "fail open for better UX".

import Anthropic from 'npm:@anthropic-ai/sdk@0.68.0';

/** Contact info and romance are forbidden until the Family stage (Part D). */
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

/** Strips accents, leetspeak and punctuation; expands chat shorthand. */
function normalize(input: string): string {
  const deaccented = input.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const deleet = [...deaccented].map((c) => LEET[c] ?? c).join('');
  const words = deleet
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/(.)\1{2,}/g, '$1$1')) // "loooove" -> "loove"
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
const digitCount = (s: string) => (s.match(/\d/g) ?? []).length;

export interface Block {
  category: string;
  reason: string;
}

export function prefilter(text: string, stage: string): Block | null {
  const norm = normalize(text);
  const sq = squash(text);

  if (hasWord(norm, PROFANITY) || hasWord(norm, SEXUAL)) {
    return { category: 'inappropriate', reason: 'profanity_or_sexual' };
  }
  if (!PRE_FAMILY.has(stage)) return null;

  if (EMAIL_RE.test(text) || URL_RE.test(text) || HANDLE_RE.test(text)) {
    return { category: 'contact_info', reason: 'email_url_or_handle' };
  }
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

export const MODEL = 'claude-opus-4-8';
export const PROMPT_VERSION = 'mithaq-mod-v1';
export const POLICY_VERSION = 'partD-v3';

const SYSTEM = `You are the moderation gate for Mithaq, an Islamic marriage platform (NOT a dating app). Couples progress through supervised stages: introduction -> serious_communication -> family -> married.

You judge ONE message from one participant. Be STRICT and treat every attempt to work around the rules as a violation, including misspellings, abbreviations, spacing tricks, leetspeak, transliteration, emoji substitution, other languages (Arabic, Franco-Arabic/Arabizi, etc.), coded hints, and anything phrased as a question or a joke. Intent counts, not literal wording: "how can I reach you outside this app?" and "my name on the app with the camera logo is X" are both contact sharing.

Block the message if ANY of these apply:

1. contact_info — the sender shares, hints at, or asks for any way to communicate off-platform, at the "introduction" or "serious_communication" stage. This covers phone numbers, emails, links, usernames/handles, and any social or messaging platform (Instagram, Snapchat, WhatsApp, Telegram, TikTok, Facebook, Discord, X/Twitter, etc.), however obliquely referenced — including "add me", "find me", "same name there", or spelling a handle out. Contact info is ONLY permitted at the "family" and "married" stages.

2. too_soon — romantic, flirtatious, or physically intimate language before the "family" stage: declarations of love ("love you", "love u", "ily"), pet names (babe, baby, honey, darling, sweetheart), compliments on the body or appearance beyond ordinary courtesy, talk of kissing/touching/missing them, or excessive emotional intensity inappropriate for a supervised introduction.

3. inappropriate — sexual content, profanity, insults, harassment, threats, hate speech, or anything degrading.

4. haram_meeting — proposing a private, unchaperoned meeting or call before the family stage.

5. scam — requests for money, financial details, external payments, or off-platform "verification".

Otherwise allow. Respectful getting-to-know-you conversation about faith, values, family, education, work, and marriage goals is exactly what this stage is for — do not block it.

The message may be a transcript of a voice note; transcription errors are not violations on their own — judge the evident meaning.

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

export interface Verdict {
  verdict: 'allowed' | 'blocked';
  category: string;
  reason: string;
}

async function aiModerate(apiKey: string, text: string, stage: string): Promise<Verdict> {
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 15_000 });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 200,
    system: SYSTEM,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    messages: [
      { role: 'user', content: `Journey stage: ${stage}\n\nMessage to moderate:\n"""\n${text}\n"""` },
    ],
  });
  const block = response.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') throw new Error('moderator_no_output');
  return JSON.parse(block.text) as Verdict;
}

/**
 * Image moderation (Family stage, Part D §3). Claude can see, so an image is judged
 * before it is ever stored. There is no local fallback for pixels — if the moderator
 * is unavailable, the image is blocked, never delivered unreviewed.
 */
const IMAGE_SYSTEM = `You are the image moderation gate for Mithaq, an Islamic marriage platform (NOT a dating app). The couple is at the Family stage: their families are involved and a guardian is present.

Judge ONE image. Block it if it contains ANY of:
- nudity, partial nudity, underwear, swimwear, or sexually suggestive posing or framing
- sexual or pornographic content of any kind
- violence, gore, weapons used threateningly, or self-harm
- alcohol, drugs, or gambling
- hateful, extremist, or illegal content
- content that appears designed to shame, harass, or expose someone
- screenshots that exist to pass along contact details or move the conversation to another platform (a phone number, an email, a QR code, a social-media handle or profile)

Allow ordinary, modest photographs a family would be comfortable seeing: faces, family and social occasions, food, travel, nature, documents, and everyday life.

Return ONLY the JSON object. No prose.`;

const IMAGE_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['allowed', 'blocked'] },
    category: { type: 'string', enum: ['none', 'inappropriate', 'contact_info', 'unsafe'] },
    reason: { type: 'string', description: 'Short explanation, max 15 words.' },
  },
  required: ['verdict', 'category', 'reason'],
  additionalProperties: false,
} as const;

export interface ModerationResult {
  blocked: boolean;
  category: string | null;
  provider: string;
  model: string;
  promptVersion: string;
}

export async function moderateImage(
  base64: string,
  mediaType: string,
  apiKey?: string | null,
): Promise<ModerationResult> {
  const ai = { provider: 'anthropic', model: MODEL, promptVersion: 'mithaq-img-v1' };
  // No moderator ⇒ no judgement ⇒ no delivery. Pixels have no local pre-filter.
  if (!apiKey) return { blocked: true, category: 'unavailable', ...ai };

  try {
    const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 20_000 });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 200,
      system: IMAGE_SYSTEM,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: IMAGE_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: 'Moderate this image.' },
          ],
        },
      ],
    });
    const block = response.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') throw new Error('moderator_no_output');
    const verdict = JSON.parse(block.text) as Verdict;
    return {
      blocked: verdict.verdict === 'blocked',
      category: verdict.verdict === 'blocked' ? verdict.category : null,
      ...ai,
    };
  } catch (err) {
    console.error('image_moderation_unavailable', err);
    return { blocked: true, category: 'unavailable', ...ai };
  }
}

/**
 * The full gate. `unavailable` means the AI moderator was configured but could not
 * be reached — the caller MUST treat that as blocked (fail-closed), not as allowed.
 */
export async function moderate(text: string, stage: string, apiKey?: string | null): Promise<ModerationResult> {
  const local = { provider: 'local', model: 'prefilter', promptVersion: 'prefilter-v2' };

  const pre = prefilter(text, stage);
  if (pre) return { blocked: true, category: pre.category, ...local };
  if (!apiKey) return { blocked: false, category: null, ...local };

  const ai = { provider: 'anthropic', model: MODEL, promptVersion: PROMPT_VERSION };
  try {
    const verdict = await aiModerate(apiKey, text, stage);
    return {
      blocked: verdict.verdict === 'blocked',
      category: verdict.verdict === 'blocked' ? verdict.category : null,
      ...ai,
    };
  } catch (err) {
    console.error('moderation_unavailable', err);
    return { blocked: true, category: 'unavailable', ...ai };
  }
}
