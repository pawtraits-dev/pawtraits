-- Create function to atomically increment pre-registration code scan count
-- This prevents race conditions when multiple scans happen simultaneously

CREATE OR REPLACE FUNCTION increment_prereg_scan_count(p_code_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE pre_registration_codes
  SET
    scans_count = COALESCE(scans_count, 0) + 1,
    updated_at = NOW()
  WHERE id = p_code_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION increment_prereg_scan_count(UUID) TO authenticated, anon;

COMMENT ON FUNCTION increment_prereg_scan_count IS 'Atomically increments the scan count for a pre-registration code';
