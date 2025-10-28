-- Migration: Increase free trial credits from 2 to 5
-- Date: 2025-10-28
-- Description: Updates the default free trial credits for new customers from 2 to 5,
--              and provides bonus credits to existing customers with low balances

BEGIN;

-- Step 1: Update the default value for future customer records
ALTER TABLE public.customer_customization_credits
  ALTER COLUMN free_trial_credits_granted SET DEFAULT 5;

-- Step 2: Give bonus credits to existing customers who have:
--   - 2 or fewer free_trial_credits_granted (they got the old amount)
--   - Less than 5 credits_remaining (they haven't used all their credits)
-- We'll add 3 credits to their remaining balance and update their free_trial_credits_granted

UPDATE public.customer_customization_credits
SET
  credits_remaining = credits_remaining + 3,
  free_trial_credits_granted = 5,
  updated_at = NOW()
WHERE
  free_trial_credits_granted <= 2
  AND credits_remaining < 5
  AND credits_purchased = 0; -- Only for users who haven't purchased credits yet

-- Step 3: For customers who already received 2 free credits but used them all,
-- give them 3 new credits as a bonus
UPDATE public.customer_customization_credits
SET
  credits_remaining = 3,
  free_trial_credits_granted = 5,
  updated_at = NOW()
WHERE
  free_trial_credits_granted = 2
  AND credits_remaining = 0
  AND credits_purchased = 0; -- Only for users who haven't purchased credits yet

-- Verification query (comment out in production)
-- SELECT
--   customer_id,
--   credits_remaining,
--   credits_purchased,
--   credits_used,
--   free_trial_credits_granted,
--   created_at
-- FROM public.customer_customization_credits
-- ORDER BY created_at DESC
-- LIMIT 20;

COMMIT;

-- Rollback instructions (if needed):
-- BEGIN;
-- ALTER TABLE public.customer_customization_credits
--   ALTER COLUMN free_trial_credits_granted SET DEFAULT 2;
-- UPDATE public.customer_customization_credits
-- SET
--   credits_remaining = GREATEST(0, credits_remaining - 3),
--   free_trial_credits_granted = 2,
--   updated_at = NOW()
-- WHERE free_trial_credits_granted = 5 AND credits_purchased = 0;
-- COMMIT;
