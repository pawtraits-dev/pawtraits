-- Fix Customer Referral Tracking
-- Remove the problematic foreign key constraint and simplify referral tracking

-- Step 1: Remove the foreign key constraint that's causing issues
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_referral_order_id_fkey;

-- Step 2: Make referral_order_id a simple UUID field (no foreign key)
-- This will just track which order completed the referral, but won't enforce FK constraint
COMMENT ON COLUMN customers.referral_order_id IS 'Order ID that completed the referral (informational only, no FK constraint)';

-- Step 3: Create a simple index for performance
CREATE INDEX IF NOT EXISTS idx_customers_referral_order_id ON customers(referral_order_id);

-- Alternative approach: If we want to completely remove referral_order_id from customers table
-- and rely on the new commissions table instead:

-- ALTER TABLE customers DROP COLUMN IF EXISTS referral_order_id;

-- This would be cleaner as all referral completion tracking would happen in the commissions table