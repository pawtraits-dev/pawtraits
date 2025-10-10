-- ========================================
-- ADD DISCOUNT_AMOUNT COLUMN TO ORDERS
-- ========================================
-- This column stores the referral discount amount applied to orders
-- Fixes: "Could not find the 'discount_amount' column of 'orders'"

-- Add discount_amount column
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS discount_amount INTEGER DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN orders.discount_amount IS
  'Referral discount amount applied to this order (in pence). ' ||
  'Tracks the discount given when customer uses a referral code.';

-- Add index for analytics queries
CREATE INDEX IF NOT EXISTS idx_orders_discount_amount
ON orders(discount_amount)
WHERE discount_amount > 0;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Successfully added discount_amount column to orders table';
END
$$;
