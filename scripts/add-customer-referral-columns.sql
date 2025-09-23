-- Add referral tracking columns to customers table
-- This migration adds the missing columns that the referrals API requires

ALTER TABLE customers
ADD COLUMN IF NOT EXISTS total_referrals INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS successful_referrals INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS rewards_earned DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS signup_discount_used INTEGER DEFAULT 0;

-- Update existing customers to have default values
UPDATE customers
SET
  total_referrals = COALESCE(total_referrals, 0),
  successful_referrals = COALESCE(successful_referrals, 0),
  rewards_earned = COALESCE(rewards_earned, 0.00),
  signup_discount_used = COALESCE(signup_discount_used, 0)
WHERE
  total_referrals IS NULL
  OR successful_referrals IS NULL
  OR rewards_earned IS NULL
  OR signup_discount_used IS NULL;

-- Verify the changes
SELECT
  email,
  personal_referral_code,
  total_referrals,
  successful_referrals,
  rewards_earned,
  signup_discount_used
FROM customers
LIMIT 5;