-- Add QR code URL columns for personal referral codes
-- This enables customers and partners to have branded QR codes for their personal referral codes

-- 1. Add qr_code_url column to customers table (if not exists)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS personal_qr_code_url TEXT;

-- 2. Add qr_code_url column to partners table (if not exists)
ALTER TABLE partners ADD COLUMN IF NOT EXISTS personal_qr_code_url TEXT;

-- 3. Add helpful comments
COMMENT ON COLUMN customers.personal_qr_code_url IS 'URL to branded QR code image for customer personal referral code';
COMMENT ON COLUMN partners.personal_qr_code_url IS 'URL to branded QR code image for partner personal referral code';

-- 4. Create indexes for performance (optional, but helpful)
CREATE INDEX IF NOT EXISTS idx_customers_personal_qr_code ON customers(personal_qr_code_url) WHERE personal_qr_code_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_partners_personal_qr_code ON partners(personal_qr_code_url) WHERE personal_qr_code_url IS NOT NULL;
