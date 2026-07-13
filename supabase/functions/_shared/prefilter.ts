// The fast, key-free half of the moderation gate (Decisions Part D).
//
// It exists to catch the OBVIOUS and the OBFUSCATED — a phone number, a handle,
// "l0ve  u", "i n s t a g r a m". It must NEVER fire on ordinary getting-to-know-you
// talk: asking someone's age, their education, how many children they want, or saying
// salam is the entire point of the Introduction stage. Anything ambiguous is left to
// the AI moderator, which can read intent; a wordlist cannot.
//
// Pure functions, no imports — so it can be unit-tested outside Deno.

/** Contact info and romance are forbidden until the Family stage (Part D). */
const PRE_FAMILY = new Set(['introduction', 'serious_communication']);

// Deliberately NOT listed (each of these caused a false positive):
//   "number", "phone", "email"  — "how many children do you want? give me a number"
//   "wa", "ig", "tg", "fb"      — "wa" is Arabic for "and"; two letters are not a platform
//   "baby", "kids", "children"  — having children is what these people are here to discuss
//   "ass", "sex"                — too close to "class", "assalamu", "sexe"/gender talk
// The AI moderator still catches "add me on ig" and "my number is …" by intent.
const PROFANITY = ['fuck', 'fucking', 'fuk', 'fck', 'shit', 'bitch', 'asshole', 'cunt', 'dick', 'pussy', 'bastard', 'slut', 'whore', 'motherfucker'];
const SEXUAL = ['sexy', 'nude', 'nudes', 'naked', 'horny', 'boobs', 'porn', 'xxx', 'hookup', 'sext'];
const ROMANTIC = [
  'i love you', 'love you', 'love u', 'luv you', 'luv u', 'ily', 'ilu', 'ilysm',
  'in love with you', 'my love', 'my queen', 'my king',
  'babe', 'sweetheart', 'sweetie', 'darling', 'cutie',
  'kiss me', 'kisses', 'hug you', 'miss you', 'miss u', 'xoxo',
  'beautiful eyes', 'you are beautiful', 'ur beautiful', 'you are gorgeous', 'you are hot',
];
const PLATFORMS = [
  'instagram', 'insta', 'snapchat', 'whatsapp', 'whats app', 'telegram', 'tiktok',
  'facebook', 'messenger', 'discord', 'skype', 'viber', 'gmail', 'hotmail',
];
const CONTACT_PHRASES = [
  'add me on', 'dm me', 'text me on', 'call me on', 'find me on', 'my handle',
  'my username', 'my number is', 'my email is', 'reach me on', 'message me on',
  'lets talk on', 'let us talk on', 'follow me on', 'give me your number',
];

const EMAIL_RE = /[a-z0-9._%+-]+\s*(?:@|\(at\)|\[at\])\s*[a-z0-9.-]+\s*(?:\.|\(dot\))\s*[a-z]{2,}/i;
const HANDLE_RE = /(^|[\s(])@[a-z0-9._]{3,}/i;
const URL_RE = /(https?:\/\/|www\.)\S+/i;

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' };
const ABBREV: Record<string, string> = { u: 'you', ur: 'your', luv: 'love', lov: 'love', bby: 'baby', bae: 'babe' };

/** Strips accents, leetspeak and punctuation; expands chat shorthand. */
export function normalize(input: string): string {
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
export function squash(input: string): string {
  return normalize(input).replace(/[^a-z0-9]/g, '');
}

const hasWord = (norm: string, words: string[]) => words.some((w) => norm.includes(` ${w} `));

/**
 * Separator-stripped matching is what defeats "i n s t a g r a m" and "l.o.v.e.u" —
 * but it is substring matching, so a SHORT token will hit innocent words: "ily" lives
 * inside "family", "insta" inside "instant". Short phrases are therefore matched as
 * whole words only; the squashed form is used only for phrases long enough that an
 * accidental collision is implausible.
 */
const SQUASH_MIN = 7;
const alnum = (s: string) => s.replace(/[^a-z0-9]/g, '');
const hasPhrase = (norm: string, sq: string, phrases: string[]) =>
  phrases.some((p) => {
    if (norm.includes(` ${p} `)) return true;
    const flat = alnum(p);
    return flat.length >= SQUASH_MIN && sq.includes(flat);
  });

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
  // A long run of digits is a phone number. An age ("18") or a count ("3 children")
  // is not — so require both a digit run AND enough digits to be a number worth dialling.
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
