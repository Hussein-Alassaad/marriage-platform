-- Payment settings — the manual (Lebanese) payment family is admin-configurable.
-- What: instructions text per method, claim expiry, subscription period lengths,
--       and a kill switch for card payments until a gateway is actually wired.
-- Why: account numbers, wait times and prices must never live in code. Admins
--      edit these rows; the settings_history trigger records every change.
--
-- Prices stay in `subscription_plans` (the plan catalog); these are the *how to
-- pay* details around them.

insert into public.settings (key, value, type, is_public, description) values
  ('card_payments_enabled', 'false', 'boolean', true,
   'Card checkout (Areeba). Keep false until the gateway credentials are configured.'),
  ('payment_claim_expiry_days', '7', 'number', true,
   'A manual payment claim auto-expires this many days after it is submitted'),
  ('subscription_period_days_monthly', '30', 'number', true,
   'Length of a monthly subscription period'),
  ('subscription_period_days_yearly', '365', 'number', true,
   'Length of a yearly subscription period'),
  ('payment_instructions_omt', '"Visit any OMT branch and send the amount to the account shown at checkout. Write your reference code on the receipt, then upload a photo of it here."', 'string', true,
   'OMT payment instructions shown to the user (admin-editable)'),
  ('payment_instructions_whish', '"Open Whish Money, send the amount to the number shown at checkout, and include your reference code in the note. Then upload the confirmation screenshot here."', 'string', true,
   'Whish Money payment instructions shown to the user (admin-editable)'),
  ('payment_instructions_bank_transfer', '"Transfer the amount to the bank account shown at checkout, using your reference code as the transfer reference. Then upload the transfer receipt here."', 'string', true,
   'Bank transfer instructions shown to the user (admin-editable)')
on conflict (key) do nothing;

-- Claims are reviewed by admins through the `subscriptions` Edge Function
-- (service role). A user may create and read their own claim, but never update
-- one — approving your own payment must be impossible.
revoke update, delete on public.payment_claims from anon, authenticated;
