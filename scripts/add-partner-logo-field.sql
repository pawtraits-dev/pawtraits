-- Add logo field to partners table for business logo display
-- Migration: Add partner logo support
-- Date: 2024

-- Add logo_url field to partners table
ALTER TABLE partners
ADD COLUMN logo_url TEXT NULL;

-- Add comment to document the field
COMMENT ON COLUMN partners.logo_url IS 'URL to partner business logo image for display on referral invitations';

-- Create index for faster lookups when fetching partners with logos
-- Note: CONCURRENTLY cannot be used inside a transaction, so running separately
CREATE INDEX IF NOT EXISTS idx_partners_logo_url
ON partners (logo_url)
WHERE logo_url IS NOT NULL;

-- Verify the change
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'partners'
AND column_name = 'logo_url';