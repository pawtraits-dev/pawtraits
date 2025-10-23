-- Initialize credit records for existing customers who don't have them
-- This is a one-time migration for customers created before the credit system was implemented

-- Insert credit records for all customers without one
INSERT INTO public.customer_customization_credits (
  customer_id,
  credits_remaining,
  credits_purchased,
  credits_used,
  free_trial_credits_granted,
  total_generations,
  total_spent_amount
)
SELECT
  up.id as customer_id,
  2 as credits_remaining,           -- Grant 2 free trial credits
  0 as credits_purchased,
  0 as credits_used,
  2 as free_trial_credits_granted,
  0 as total_generations,
  0 as total_spent_amount
FROM public.user_profiles up
WHERE up.user_type = 'customer'
  AND NOT EXISTS (
    SELECT 1
    FROM public.customer_customization_credits ccc
    WHERE ccc.customer_id = up.id
  );

-- Display results
SELECT
  'Initialized credits for ' || COUNT(*) || ' existing customers' as result
FROM public.customer_customization_credits
WHERE created_at >= NOW() - INTERVAL '1 minute';
