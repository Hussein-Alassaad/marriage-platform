-- Paddle card-payment integration. `card` has existed in the payments.method
-- enum since Phase 2 (seeded ahead of a real gateway, never used) -- this is
-- what finally uses it. Two things need to persist:
--   1. Which Paddle Price ID corresponds to which plan/period, so the
--      checkout knows what to open.
--   2. Which Paddle subscription a row here corresponds to, so a renewal or
--      cancellation webhook can find the right row to update.
-- `payments.gateway_ref` already exists (used for OMT/Whish reference codes)
-- and is reused for the Paddle transaction ID -- no new column needed there.

alter table public.subscription_plans
  add column paddle_price_id_monthly text,
  add column paddle_price_id_yearly text;

alter table public.subscriptions
  add column paddle_subscription_id text;

create index subscriptions_paddle_subscription_id_idx
  on public.subscriptions (paddle_subscription_id)
  where paddle_subscription_id is not null;

update public.subscription_plans
set paddle_price_id_monthly = 'pri_01kyzz5yhwyc1dqj7avxnqhkcj',
    paddle_price_id_yearly = 'pri_01kyzz5zdz1m1205arv3wy4d83'
where tier = 'serious';

update public.subscription_plans
set paddle_price_id_monthly = 'pri_01kyzz5zxfrg4bpt3wvbn4nh2k'
where tier = 'marriage_plus';
