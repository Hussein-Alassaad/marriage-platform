/**
 * Local-calendar date keys. Never round-trip through `Date#toISOString()` for this —
 * it reports UTC, so for any positive-UTC-offset timezone (e.g. Beirut, UTC+2/+3),
 * a date built as local midnight can land on the *previous* UTC day, silently
 * shifting `monthKey`/`dateKey` back by one. That bug shipped in the finance charts'
 * six-month lookback and the Financial Health score's month buckets: both built a
 * local "day 1" Date then called `.toISOString()`, so every bucket was one month
 * behind — the current month's real entries never matched any bucket, and charts
 * reported "no history" despite entries existing.
 */
export function monthKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function dateKey(d: Date = new Date()): string {
  return `${monthKey(d)}-${String(d.getDate()).padStart(2, '0')}`;
}
