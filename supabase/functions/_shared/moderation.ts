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

import { prefilter, type Block } from './prefilter.ts';

export { prefilter, type Block };

export const MODEL = 'claude-opus-4-8';
export const PROMPT_VERSION = 'mithaq-mod-v2'; // v2: allow-by-default, explicit marriage whitelist
export const POLICY_VERSION = 'partD-v4';

const SYSTEM = `You are the moderation gate for Mithaq, an Islamic marriage platform (NOT a dating app). Two people who are considering marriage are getting to know each other under supervision. They progress through stages: introduction -> serious_communication -> family -> married.

Your DEFAULT is to ALLOW. These people are supposed to be talking. Block only a clear violation of the rules below. When a message is ordinary, ambiguous, or merely awkward, ALLOW it.

## ALWAYS ALLOW (never block these)

- Islamic and cultural greetings in any spelling or transliteration: "salam", "salam 3lykom", "assalamu alaikum", "السلام عليكم", "wa alaikum assalam", "jazak Allah khayr", "insha'Allah", "masha'Allah", "alhamdulillah".
- Direct, practical questions and answers about marriage suitability — this is the entire purpose of the conversation:
  age ("my age is 18", "how old are you?"), education, degrees, school, university, work, job, career, income range, financial expectations,
  children ("how many children do you want?", "do you want kids?", "I'd like three children"), family, parents, siblings, living with family,
  religion, prayer, madhhab, hijab, practice, values, ethics, expectations of a spouse,
  city, country, relocation, housing, future plans, timeline for marriage, health, languages, hobbies, cooking, sports.
- Ordinary numbers used in that conversation: ages, number of children, years of study, salary ranges, dates, quantities. A number is only a violation when it is plainly a way to CONTACT someone (a phone number, a WhatsApp number, an account ID).
- Ordinary courtesy and warmth: "nice to meet you", "thank you", "I appreciate your reply", "may Allah bless you", "I found your profile respectful".
- Saying they are interested in marriage, or that they think the two of them may be compatible. That is not romance — that is the point of the platform.
- Arabic, Franco-Arabic/Arabizi, French, or any other language, and messages with typos or transcription errors. Judge the evident meaning, not the spelling.

## BLOCK ONLY THESE

1. contact_info — the sender shares, hints at, or asks for a way to communicate OFF the platform, at the "introduction" or "serious_communication" stage. Phone/WhatsApp numbers, emails, links, QR codes, usernames/handles, or any social or messaging platform (Instagram, Snapchat, WhatsApp, Telegram, TikTok, Facebook, Discord, X/Twitter…), however obliquely referenced — including "add me", "find me there", "same name on the app with the camera logo", or spelling a handle out letter by letter. Contact info is permitted ONLY at the "family" and "married" stages.

2. too_soon — romantic, flirtatious, or physically intimate language before the "family" stage: declarations of love ("I love you", "love u", "ily"), pet names (babe, honey, darling, sweetheart, my love), compliments on the body or looks beyond ordinary courtesy ("you're so hot", "beautiful eyes"), talk of kissing/touching/missing them, or intense emotional attachment inappropriate for a supervised introduction. NOTE: discussing wanting children, or wanting to marry, is NOT romance — allow it.

3. inappropriate — sexual content, profanity, insults, harassment, threats, hate speech, or degrading language.

4. haram_meeting — proposing a private, unchaperoned meeting or phone/video call before the family stage. (Discussing a future meeting WITH the families present is allowed.)

5. scam — requests for money, bank/financial details, external payments, or off-platform "verification".

Treat deliberate evasion of rules 1–5 as a violation: misspellings, spacing tricks, leetspeak, emoji substitution, coded hints, or phrasing it as a joke or a question. But do not invent violations that are not there — an innocent message with a typo is still innocent.

Return ONLY the JSON object, nothing else.`;

const OUTPUT_SHAPE = `Respond with exactly this JSON and nothing else:
{"verdict": "allowed" | "blocked", "category": "none" | "contact_info" | "too_soon" | "inappropriate" | "haram_meeting" | "scam", "reason": "<max 15 words>"}`;

export interface Verdict {
  verdict: 'allowed' | 'blocked';
  category: string;
  reason: string;
}

/** Pull the JSON object out of a reply, tolerating code fences or a stray sentence. */
function parseVerdict(raw: string): Verdict {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error(`moderator_bad_output: ${raw.slice(0, 120)}`);
  const parsed = JSON.parse(raw.slice(start, end + 1)) as Partial<Verdict>;
  if (parsed.verdict !== 'allowed' && parsed.verdict !== 'blocked') {
    throw new Error(`moderator_bad_verdict: ${raw.slice(0, 120)}`);
  }
  return { verdict: parsed.verdict, category: parsed.category ?? 'none', reason: parsed.reason ?? '' };
}

/**
 * Models to try, in order. The first is the intended moderator; the others are
 * fallbacks for an account/key that cannot reach it, so a model-access problem
 * degrades to a working moderator instead of blocking every message on the platform.
 * Override the primary with the MODERATION_MODEL secret.
 */
function models(): string[] {
  const primary = Deno.env.get('MODERATION_MODEL') ?? MODEL;
  return [...new Set([primary, 'claude-sonnet-5', 'claude-haiku-4-5'])];
}

async function aiModerate(apiKey: string, text: string, stage: string): Promise<Verdict> {
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 15_000 });
  const errors: string[] = [];

  for (const model of models()) {
    try {
      const response = await client.messages.create({
        model,
        max_tokens: 200,
        system: `${SYSTEM}\n\n${OUTPUT_SHAPE}`,
        messages: [
          { role: 'user', content: `Journey stage: ${stage}\n\nMessage to moderate:\n"""\n${text}\n"""` },
        ],
      });
      const block = response.content.find((b) => b.type === 'text');
      if (!block || block.type !== 'text') throw new Error('moderator_no_output');
      return parseVerdict(block.text);
    } catch (err) {
      // Keep the real reason — a silent block that nobody can explain is the worst
      // possible failure mode for a moderation gate.
      errors.push(`${model}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(errors.join(' | '));
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

const IMAGE_OUTPUT_SHAPE = `Respond with exactly this JSON and nothing else:
{"verdict": "allowed" | "blocked", "category": "none" | "inappropriate" | "contact_info" | "unsafe", "reason": "<max 15 words>"}`;

export interface ModerationResult {
  blocked: boolean;
  category: string | null;
  provider: string;
  model: string;
  promptVersion: string;
  /** Only set when category is 'unavailable' — the real reason, for the logs. */
  detail?: string;
}

export async function moderateImage(
  base64: string,
  mediaType: string,
  apiKey?: string | null,
): Promise<ModerationResult> {
  const ai = { provider: 'anthropic', model: MODEL, promptVersion: 'mithaq-img-v1' };
  // No moderator ⇒ no judgement ⇒ no delivery. Pixels have no local pre-filter.
  if (!apiKey) return { blocked: true, category: 'unavailable', ...ai };

  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 20_000 });
  const errors: string[] = [];

  for (const model of models()) {
    try {
      const response = await client.messages.create({
        model,
        max_tokens: 200,
        system: `${IMAGE_SYSTEM}\n\n${IMAGE_OUTPUT_SHAPE}`,
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
      const verdict = parseVerdict(block.text);
      return {
        blocked: verdict.verdict === 'blocked',
        category: verdict.verdict === 'blocked' ? verdict.category : null,
        ...ai,
      };
    } catch (err) {
      errors.push(`${model}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const detail = errors.join(' | ');
  console.error('image_moderation_unavailable', detail);
  return { blocked: true, category: 'unavailable', detail, ...ai };
}

/**
 * The full gate. `unavailable` means the AI moderator was configured but could not
 * be reached — the caller MUST treat that as blocked (fail-closed), not as allowed.
 */
export async function moderate(text: string, stage: string, apiKey?: string | null): Promise<ModerationResult> {
  const local = { provider: 'local', model: 'prefilter', promptVersion: 'prefilter-v3' };

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
    const detail = err instanceof Error ? err.message : String(err);
    console.error('moderation_unavailable', detail);
    return { blocked: true, category: 'unavailable', detail, ...ai };
  }
}
