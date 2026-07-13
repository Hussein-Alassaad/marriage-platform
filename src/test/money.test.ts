import { describe, expect, it } from 'vitest';

import { convert, sumIn, toRateMap, type Rate } from '@/utils/money';

const rate = (quote: string, value: number, as_of = '2026-07-14'): Rate => ({
  base_currency: 'USD',
  quote_currency: quote,
  rate: value,
  as_of,
});

describe('money', () => {
  describe('toRateMap', () => {
    it('keeps the newest rate per currency', () => {
      // The service orders newest-first; the first row for a currency wins.
      const map = toRateMap([rate('LBP', 90000, '2026-07-14'), rate('LBP', 89500, '2026-07-01')]);
      expect(map.LBP).toBe(90000);
    });

    it('always knows USD', () => {
      expect(toRateMap([]).USD).toBe(1);
    });
  });

  describe('convert', () => {
    const rates = toRateMap([rate('LBP', 89500), rate('EUR', 0.92)]);

    it('is a no-op within one currency', () => {
      expect(convert(100, 'USD', 'USD', rates)).toBe(100);
    });

    it('converts through USD', () => {
      expect(convert(89500, 'LBP', 'USD', rates)).toBeCloseTo(1);
      expect(convert(1, 'USD', 'LBP', rates)).toBeCloseTo(89500);
      // LBP → EUR pivots through USD.
      expect(convert(89500, 'LBP', 'EUR', rates)).toBeCloseTo(0.92);
    });

    it('returns null rather than inventing a figure for an unknown currency', () => {
      expect(convert(100, 'JPY', 'USD', rates)).toBeNull();
      expect(convert(100, 'USD', 'JPY', rates)).toBeNull();
    });
  });

  describe('sumIn', () => {
    const rates = toRateMap([rate('LBP', 89500)]);

    it('adds mixed currencies in the display currency', () => {
      const { total, unconvertible } = sumIn(
        [
          { amount: 10, currency: 'USD' },
          { amount: 89500, currency: 'LBP' },
        ],
        'USD',
        rates,
      );
      expect(total).toBeCloseTo(11);
      expect(unconvertible).toBe(0);
    });

    it('reports what it could not convert instead of dropping it silently', () => {
      const { total, unconvertible } = sumIn(
        [
          { amount: 10, currency: 'USD' },
          { amount: 500, currency: 'JPY' },
        ],
        'USD',
        rates,
      );
      expect(total).toBe(10);
      expect(unconvertible).toBe(1);
    });
  });
});
