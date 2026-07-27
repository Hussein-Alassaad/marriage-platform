import { monthKey } from '@/utils/date';
import { sumIn, type RateMap } from '@/utils/money';
import type { Budget, Entry, Goal } from '@/services/financeService';

/**
 * Financial Health Score (PRD Part 8) — deterministic, like the rest of this
 * platform's scores (no AI key): Savings Rate, Budget Consistency, Emergency Fund,
 * Income Stability, Goal Progress, averaged equally. Debt Level (PRD: "optional") is
 * omitted — there is no debt-tracking field anywhere in the schema, and inventing a
 * new data-collection surface just for this score is out of scope.
 *
 * "The score is educational only. Never judge users. Always explain improvements."
 * (PRD) — any UI showing this number carries that framing; see
 * `finance.health.disclaimer` in i18n.
 *
 * A factor with no signal yet (no budgets, no goals, under 2 months of income
 * history) scores a neutral 60 rather than 0 — an empty ledger is not a FAILING
 * ledger, same "no signal" convention the compatibility engine uses for
 * personality.
 */
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function lastNMonths(n: number, from: Date): string[] {
  const months: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1);
    months.push(monthKey(d));
  }
  return months;
}

export function computeFinancialHealth(
  entries: Entry[],
  budgets: Budget[],
  goals: Goal[],
  currency: string,
  rates: RateMap,
): number {
  const now = new Date();
  const thisMonth = monthKey(now);
  const inMonth = (m: string) => entries.filter((e) => e.occurred_on.startsWith(m));
  const totalIn = (rows: Entry[], kind: Entry['kind']) =>
    sumIn(
      rows.filter((r) => r.kind === kind).map((r) => ({ amount: r.amount, currency: r.currency })),
      currency,
      rates,
    ).total;

  // Savings Rate — this month's (income - expenses) / income. 30%+ saved scores 100.
  const thisIncome = totalIn(inMonth(thisMonth), 'income');
  const thisExpenses = totalIn(inMonth(thisMonth), 'expense');
  const savingsRateScore =
    thisIncome > 0 ? clamp(Math.round(((thisIncome - thisExpenses) / thisIncome / 0.3) * 100), 0, 100) : 0;

  // Budget Consistency — share of this month's budget categories not over their limit.
  let budgetScore = 60;
  if (budgets.length) {
    let within = 0;
    for (const b of budgets) {
      const spent = sumIn(
        inMonth(thisMonth)
          .filter((e) => e.kind === 'expense' && e.label === b.category)
          .map((e) => ({ amount: e.amount, currency: e.currency })),
        b.currency,
        rates,
      ).total;
      if (spent <= b.amount) within += 1;
    }
    budgetScore = Math.round((within / budgets.length) * 100);
  }

  // Emergency Fund — months of average expenses covered by total savings-goal balances.
  // 6 months covered scores 100.
  const monthsSeen = new Set(entries.map((e) => e.occurred_on.slice(0, 7)));
  const avgMonthlyExpenses = monthsSeen.size ? totalIn(entries, 'expense') / monthsSeen.size : 0;
  const totalSaved = sumIn(
    goals.map((g) => ({ amount: g.current_amount, currency: g.currency })),
    currency,
    rates,
  ).total;
  const emergencyScore =
    avgMonthlyExpenses > 0 ? clamp(Math.round((totalSaved / avgMonthlyExpenses / 6) * 100), 0, 100) : 60;

  // Income Stability — coefficient of variation across up to the last 6 months with income.
  const monthlyIncomes = lastNMonths(6, now)
    .map((m) => totalIn(inMonth(m), 'income'))
    .filter((v) => v > 0);
  let stabilityScore = 60;
  if (monthlyIncomes.length >= 2) {
    const mean = monthlyIncomes.reduce((a, b) => a + b, 0) / monthlyIncomes.length;
    const variance =
      monthlyIncomes.reduce((a, b) => a + (b - mean) ** 2, 0) / monthlyIncomes.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
    stabilityScore = clamp(Math.round(100 - cv * 200), 0, 100);
  }

  // Goal Progress — average completion across all savings goals.
  let goalScore = 60;
  if (goals.length) {
    const pcts = goals.map((g) =>
      g.target_amount > 0 ? Math.min(g.current_amount / g.target_amount, 1) * 100 : 0,
    );
    goalScore = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
  }

  return Math.round((savingsRateScore + budgetScore + emergencyScore + stabilityScore + goalScore) / 5);
}
