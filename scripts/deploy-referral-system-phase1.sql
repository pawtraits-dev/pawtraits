-- Referral System Phase 1 - Database Migration
-- Run this in Supabase SQL Editor

-- 1. Create function for pre-registration code scan tracking
CREATE OR REPLACE FUNCTION increment_prereg_scan_count(p_code_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE pre_registration_codes
  SET scans_count = COALESCE(scans_count, 0) + 1,
      updated_at = NOW()
  WHERE id = p_code_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create function for customer referral scan tracking
CREATE OR REPLACE FUNCTION increment_customer_referral_scans(p_customer_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE customers
  SET referral_scans_count = COALESCE(referral_scans_count, 0) + 1
  WHERE id = p_customer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Add customer referral tracking columns
ALTER TABLE customers ADD COLUMN IF NOT EXISTS referred_by_customer_id UUID;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS referrer_type TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS referral_qr_url TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS referral_scans_count INTEGER DEFAULT 0;

-- 4. Add foreign key constraint
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_referred_by_customer_id_fkey;
ALTER TABLE customers ADD CONSTRAINT customers_referred_by_customer_id_fkey
  FOREIGN KEY (referred_by_customer_id) REFERENCES customers(id);

-- 5. Add check constraint for referrer_type
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_referrer_type_check;
ALTER TABLE customers ADD CONSTRAINT customers_referrer_type_check
  CHECK (referrer_type IS NULL OR referrer_type IN ('partner', 'customer', 'influencer', 'organic'));

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_referred_by_customer ON customers(referred_by_customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_referrer_type ON customers(referrer_type);

-- 7. Grant execute permissions
GRANT EXECUTE ON FUNCTION increment_prereg_scan_count(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION increment_customer_referral_scans(UUID) TO authenticated, anon;
