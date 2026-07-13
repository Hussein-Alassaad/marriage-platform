-- Shared (couple) finance: writes belong to the `finance` Edge Function only.
-- What: revoke client write grants on the two finance tables that cross two users.
-- Why: shared_finance is a CONSENT record — if a client could write it, one spouse
--      could consent on the other's behalf and open their monthly totals without
--      permission. RLS already exposes only a select policy here; the revoke means a
--      future permissive policy still cannot open a write path by accident.
--      Personal finance (income/expenses/budgets/goals) is deliberately NOT revoked:
--      those rows are owner-only, they belong to the member, and the client writes
--      them directly.

revoke insert, update, delete on public.shared_finance from anon, authenticated;
revoke insert, update, delete on public.financial_reports from anon, authenticated;
revoke insert, update, delete on public.exchange_rates from anon, authenticated;
