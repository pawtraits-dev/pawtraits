-- Add qr_scans_count field to customer_referrals table
-- This field will track how many times the QR code has been scanned for each referral

-- Add the column
ALTER TABLE public.customer_referrals
ADD COLUMN qr_scans_count INTEGER NOT NULL DEFAULT 0;

-- Add a comment to document the field
COMMENT ON COLUMN public.customer_referrals.qr_scans_count IS 'Number of times the QR code was scanned for this referral';

-- Create an index for better query performance when filtering/sorting by scan count
CREATE INDEX IF NOT EXISTS idx_customer_referrals_qr_scans_count
ON public.customer_referrals(qr_scans_count)
WHERE qr_scans_count > 0;

-- Update existing records to set default value (optional, since DEFAULT 0 handles this)
-- UPDATE public.customer_referrals SET qr_scans_count = 0 WHERE qr_scans_count IS NULL;

-- Verify the change
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'customer_referrals'
AND column_name = 'qr_scans_count';