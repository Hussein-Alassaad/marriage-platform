/**
 * Currency conversion and formatting (Decision #14).
 *
 * Amounts are STORED in the currency the member typed them in and converted only for
 * display, because the LBP moves too fast for a stored USD figure to stay honest. Every
 * rate is quoted from USD, so conversion pivots through USD: X→USD→Y. A missing rate
 * returns null rather than a wrong number — a finance screen that quietly invents a
 * figure is worse than one that says it cannot convert.
 */

export interface Rate {
  base_currency: string;
  quote_currency: string;
  rate: number;
  as_of: string;
}

/** rate map: currency → how many units of it one USD buys. */
export type RateMap = Record<string, number>;

/** Latest row per quote currency (rows arrive newest-first from the service). */
export function toRateMap(rates: Rate[]): RateMap {
  const map: RateMap = { USD: 1 };
  for (const r of rates) {
    if (r.base_currency !== 'USD') continue;
    if (map[r.quote_currency] === undefined) map[r.quote_currency] = Number(r.rate);
  }
  return map;
}

/** Converts between two currencies via USD. Returns null when a rate is unknown. */
export function convert(amount: number, from: string, to: string, rates: RateMap): number | null {
  if (from === to) return amount;
  const fromRate = rates[from];
  const toRate = rates[to];
  if (!fromRate || !toRate) return null;
  return (amount / fromRate) * toRate;
}

/**
 * Sums mixed-currency amounts into one display currency. Entries whose currency has no
 * rate are counted in `unconvertible` instead of being silently dropped, so the UI can
 * say so.
 */
export function sumIn<T extends { amount: number; currency: string }>(
  entries: T[],
  display: string,
  rates: RateMap,
): { total: number; unconvertible: number } {
  let total = 0;
  let unconvertible = 0;
  for (const e of entries) {
    const value = convert(Number(e.amount), e.currency, display, rates);
    if (value == null) unconvertible += 1;
    else total += value;
  }
  return { total, unconvertible };
}

/**
 * Locale-aware currency formatting. LBP has no meaningful minor unit, so it is shown
 * without decimals; everything else keeps two.
 */
export function formatMoney(amount: number, currency: string, locale: string): string {
  const fractionDigits = currency === 'LBP' ? 0 : 2;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(amount);
  } catch {
    // Unknown ISO code (an admin added something exotic): fall back to plain digits.
    return `${currency} ${amount.toFixed(fractionDigits)}`;
  }
}
