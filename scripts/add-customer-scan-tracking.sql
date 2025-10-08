-- Add customer scan tracking for personal referral codes
-- This tracks scans of customer's personal referral code by prospective new customers

-- 1. Add referral_scans_count column to customers table (if not exists)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS referral_scans_count INTEGER DEFAULT 0;

-- 2. Create index for performance
CREATE INDEX IF NOT EXISTS idx_customers_referral_scans ON customers(referral_scans_count);

-- 3. Create RPC function to increment customer referral scans atomically
CREATE OR REPLACE FUNCTION increment_customer_referral_scans(p_customer_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE customers
  SET referral_scans_count = COALESCE(referral_scans_count, 0) + 1
  WHERE id = p_customer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Grant execute permissions
GRANT EXECUTE ON FUNCTION increment_customer_referral_scans(UUID) TO authenticated, anon;

-- 5. Add helpful comment
COMMENT ON COLUMN customers.referral_scans_count IS 'Number of scans of customer personal referral code by prospective new customers';
