import { describe, expect, it } from 'vitest';

import { prefilter } from '../../supabase/functions/_shared/prefilter';

/**
 * The pre-filter's job is to catch the obvious and the obfuscated WITHOUT ever firing
 * on the conversation the platform exists to host. Every "allowed" case below is a
 * message a real member sent (or would send) that must reach the other person.
 */
describe('moderation pre-filter', () => {
  const intro = (text: string) => prefilter(text, 'introduction');

  describe('allows the marriage conversation', () => {
    const allowed = [
      // Greetings, in every spelling people actually use.
      'salam 3lykom',
      'assalamu alaikum',
      'wa alaikum assalam wa rahmatullah',
      'salam, kifak?',
      // Straight questions and answers — the entire point of the Introduction stage.
      'my age is 18',
      'how old are you?',
      'how many children do you want?',
      'I would like 3 children insha Allah',
      'what is your educational level?',
      'I have a bachelor degree in engineering',
      'I work as a teacher and I live with my family',
      'do you pray regularly?',
      'I want to marry within one year insha Allah',
      'what are your future plans?',
      'my salary is around 1200 per month',
      'I have 2 brothers and 1 sister',
      'nice to meet you, jazak Allah khayr',
      'I found your profile respectful and I am interested in marriage',
      // Regression: "family" contains "ily", "instant" contains "insta". Short tokens
      // must never be matched as substrings of innocent words.
      'I live with my family and I love spending time with them',
      'I will reply instantly, insha Allah',
      'I studied at the American University, class of 2019',
    ];
    it.each(allowed)('allows %j', (text) => {
      expect(intro(text)).toBeNull();
    });
  });

  describe('still blocks what it must', () => {
    it('blocks a phone number', () => {
      expect(intro('my number is 03 123 456')?.category).toBe('contact_info');
      expect(intro('call me on 0096171234567')?.category).toBe('contact_info');
    });
    it('blocks social handles and platforms, however spelled', () => {
      expect(intro('add me on instagram')?.category).toBe('contact_info');
      expect(intro('my name on i n s t a g r a m is hussein')?.category).toBe('contact_info');
      expect(intro('lets talk on whatsapp')?.category).toBe('contact_info');
      expect(intro('@hussein_92')?.category).toBe('contact_info');
    });
    it('blocks links and emails', () => {
      expect(intro('check https://example.com')?.category).toBe('contact_info');
      expect(intro('write to me at hussein@gmail.com')?.category).toBe('contact_info');
    });
    it('blocks asking to move off the platform', () => {
      expect(intro('can you send me your number?')?.category).toBe('contact_info');
      expect(intro('lets talk outside the app')?.category).toBe('contact_info');
      expect(intro('can we do a video call tonight?')?.category).toBe('contact_info');
      expect(intro('what is your account')?.category).toBe('contact_info');
    });
    it('blocks premature romance, including evasions', () => {
      expect(intro('love you')?.category).toBe('too_soon');
      expect(intro('love u')?.category).toBe('too_soon');
      expect(intro('l0ve  u')?.category).toBe('too_soon');
      expect(intro('ily')?.category).toBe('too_soon');
      expect(intro('i miss u so much')?.category).toBe('too_soon');
    });
    it('blocks profanity and sexual content at every stage', () => {
      expect(prefilter('you are a bitch', 'family')?.category).toBe('inappropriate');
      expect(prefilter('send me nudes', 'married')?.category).toBe('inappropriate');
    });
  });

  describe('relaxes contact rules at the Family stage (Part D)', () => {
    it('allows a phone number once the guardian is involved', () => {
      expect(prefilter('my number is 03 123 456', 'family')).toBeNull();
      expect(prefilter('add me on whatsapp', 'family')).toBeNull();
    });
  });
});
