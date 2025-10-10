-- ========================================
-- ADD REFERRAL_CODE COLUMN TO ORDERS
-- ========================================
-- This column stores the referral code used when placing the order
-- Fixes: Validation API was checking non-existent referral_code column
-- Now we can track which orders used referral codes for better analytics

-- Add referral_code column
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS referral_code TEXT;

-- Add comment for documentation
COMMENT ON COLUMN orders.referral_code IS
  'Referral code used when placing this order. ' ||
  'Can be a partner referral code or customer personal referral code. ' ||
  'Used to prevent customers from reusing referral discounts on multiple orders.';

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_referral_code
ON orders(referral_code)
WHERE referral_code IS NOT NULL;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Successfully added referral_code column to orders table';
END
$$;
