-- Finance module settings + seed exchange rates (Decisions #14 and #17).
-- What: the currency list, the expense category list, the tier gates for charts /
--       goals / shared finance, and a starting set of USD-based rates.
-- Why: Decision #14 says amounts are stored in their ORIGINAL currency and converted
--      for display, so a rate table must exist before the first expense is entered —
--      otherwise a Lebanese member entering LBP sees nothing on a USD dashboard.
--      Rates here are a seed, not a source of truth: the exchange-rate job (Phase 13)
--      overwrites them daily, and every historical report snapshots the rates it used
--      so old reports do not silently change when the LBP moves.
--
-- Categories and currencies are settings, not enums, because an admin must be able to
-- add "Zakat" or switch on EGP without a migration.

insert into public.settings (key, value, type, is_public, description) values
  ('finance_currencies', '["USD","LBP","EUR","GBP","AED","SAR","TRY","EGP"]', 'json', true,
   'Currencies members may record amounts in'),
  ('finance_default_currency', '"USD"', 'string', true,
   'Currency a new finance account starts in'),
  ('finance_expense_categories',
   '["housing","food","transport","utilities","health","education","family","savings","charity","wedding","other"]',
   'json', true,
   'Expense categories offered in the entry form (i18n keys)'),
  ('finance_charts_min_tier', '"serious"', 'string', true,
   'Minimum tier for charts, statistics, budgets, goals and reports (Decision #17)'),
  ('finance_shared_min_tier', '"marriage_plus"', 'string', true,
   'Minimum tier for advanced Couple Finance (Decision #17). The Married Stage is required regardless.'),
  ('finance_ai_insights_enabled', 'false', 'boolean', true,
   'Show AI financial insights. Requires ANTHROPIC_API_KEY; off until it is funded.')
on conflict (key) do nothing;

-- Seed rates, all quoted from USD. `on conflict do nothing` keeps a re-run harmless
-- and never clobbers a fresher row written by the rate job for the same day.
insert into public.exchange_rates (base_currency, quote_currency, rate, as_of) values
  ('USD', 'USD', 1, current_date),
  ('USD', 'LBP', 89500, current_date),
  ('USD', 'EUR', 0.92, current_date),
  ('USD', 'GBP', 0.79, current_date),
  ('USD', 'AED', 3.67, current_date),
  ('USD', 'SAR', 3.75, current_date),
  ('USD', 'TRY', 34.5, current_date),
  ('USD', 'EGP', 48.5, current_date)
on conflict (base_currency, quote_currency, as_of) do nothing;
