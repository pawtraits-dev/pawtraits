-- Add partner scan tracking for personal referral codes
-- This tracks customer scans of partner's personal code (separate from pre-reg code scans)

-- 1. Add referral_scans_count column to partners table
ALTER TABLE partners ADD COLUMN IF NOT EXISTS referral_scans_count INTEGER DEFAULT 0;

-- 2. Create index for performance
CREATE INDEX IF NOT EXISTS idx_partners_referral_scans ON partners(referral_scans_count);

-- 3. Create RPC function to increment partner referral scans atomically
CREATE OR REPLACE FUNCTION increment_partner_referral_scans(p_partner_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE partners
  SET referral_scans_count = COALESCE(referral_scans_count, 0) + 1
  WHERE id = p_partner_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Grant execute permissions
GRANT EXECUTE ON FUNCTION increment_partner_referral_scans(UUID) TO authenticated, anon;

-- 5. Add helpful comment
COMMENT ON COLUMN partners.referral_scans_count IS 'Number of customer scans of partner personal referral code (resets to 0 when partner activates)';
