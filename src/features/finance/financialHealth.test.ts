import { describe, expect, it } from 'vitest';

import { computeFinancialHealth } from './financialHealth';
import { monthKey } from '@/utils/date';
import type { Budget, Entry, Goal } from '@/services/financeService';

const RATES = { USD: 1 };
const today = new Date();
const thisMonth = monthKey(today);

function entry(overrides: Partial<Entry>): Entry {
  return {
    id: 'e1',
    amount: 0,
    currency: 'USD',
    occurred_on: `${thisMonth}-05`,
    recurring: false,
    label: 'salary',
    kind: 'income',
    ...overrides,
  };
}

describe('computeFinancialHealth', () => {
  it('is a neutral-ish baseline with no data at all', () => {
    // No income this month -> savings rate 0; everything else has no signal -> 60.
    // (0 + 60 + 60 + 60 + 60) / 5 = 48.
    expect(computeFinancialHealth([], [], [], 'USD', RATES)).toBe(48);
  });

  it('rewards a healthy savings rate this month', () => {
    const entries: Entry[] = [
      entry({ id: 'i1', kind: 'income', amount: 1000 }),
      entry({ id: 'x1', kind: 'expense', amount: 700, label: 'food' }),
    ];
    // savings rate (300/1000=30%) -> 100; rest neutral/zero as above.
    // (100 + 60 + 0 + 60 + 60) / 5 = 56
    expect(computeFinancialHealth(entries, [], [], 'USD', RATES)).toBe(56);
  });

  it('flags a budget category that is over its limit', () => {
    const entries: Entry[] = [entry({ id: 'x1', kind: 'expense', amount: 500, label: 'food' })];
    const budgets: Budget[] = [{ id: 'b1', category: 'food', amount: 200, currency: 'USD', period: 'monthly' }];
    // budget score 0 (1 of 1 over) instead of the neutral 60.
    // (0 + 0 + 0 + 60 + 60) / 5 = 24
    expect(computeFinancialHealth(entries, budgets, [], 'USD', RATES)).toBe(24);
  });

  it('rewards goal progress', () => {
    const goals: Goal[] = [
      { id: 'g1', name: 'Wedding', target_amount: 1000, current_amount: 1000, currency: 'USD', deadline: null },
    ];
    // goal score 100 instead of neutral 60; everything else as the empty baseline
    // (no expense history at all, so emergency fund has no signal either).
    // (0 + 60 + 60 + 60 + 100) / 5 = 56
    expect(computeFinancialHealth([], [], goals, 'USD', RATES)).toBe(56);
  });
});
