-- ========================================
-- PARTNER REFERRAL SCAN TRACKING
-- ========================================
-- This script creates the RPC function to increment partner scan counts
-- when their personal referral code QR is scanned via /c/[code]
--
-- Execute this SQL in Supabase SQL Editor:
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Click "New Query"
-- 3. Paste and execute this SQL

-- Create RPC function to increment partner referral scans atomically
CREATE OR REPLACE FUNCTION increment_partner_referral_scans(p_partner_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE partners
  SET referral_scans_count = COALESCE(referral_scans_count, 0) + 1
  WHERE id = p_partner_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION increment_partner_referral_scans(UUID) TO authenticated, anon;

-- Add helpful comment
COMMENT ON FUNCTION increment_partner_referral_scans(UUID) IS 'Atomically increments partner referral scan count when their personal code is scanned';
