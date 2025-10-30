-- Migration: Add last_scanned_at timestamp to pre_registration_codes
-- Date: 2025-10-30
-- Description: Adds last_scanned_at column to track when pre-registration codes
--              were last scanned via /p/[code] routes, and updates the RPC function
--              to automatically set this timestamp when incrementing scan count

BEGIN;

-- Step 1: Add last_scanned_at column to pre_registration_codes table
ALTER TABLE public.pre_registration_codes
  ADD COLUMN IF NOT EXISTS last_scanned_at timestamp with time zone;

-- Step 2: Create or replace the RPC function to update both scan count and timestamp
CREATE OR REPLACE FUNCTION public.increment_prereg_scan_count(p_code_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.pre_registration_codes
  SET
    scans_count = scans_count + 1,
    last_scanned_at = NOW(),
    updated_at = NOW()
  WHERE id = p_code_id;
END;
$$;

-- Step 3: Add comment for documentation
COMMENT ON COLUMN public.pre_registration_codes.last_scanned_at IS
  'Timestamp of the most recent scan of this pre-registration code via /p/[code] route';

COMMIT;

-- Rollback instructions (if needed):
-- BEGIN;
-- ALTER TABLE public.pre_registration_codes DROP COLUMN IF EXISTS last_scanned_at;
-- -- The RPC function will continue to work even without the column (it will just update scans_count)
-- COMMIT;
