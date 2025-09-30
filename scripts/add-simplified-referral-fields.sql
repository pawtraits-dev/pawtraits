-- Add simplified referral fields to customers table
-- This will replace the complex multi-table referral system with simple fields on customer records

-- Add referral_type enum field to track the source of the referral
DO $$ BEGIN
  CREATE TYPE referral_type_enum AS ENUM ('PARTNER', 'CUSTOMER', 'INFLUENCER', 'ORGANIC');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add new referral fields to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS referral_type referral_type_enum DEFAULT 'ORGANIC',
ADD COLUMN IF NOT EXISTS referrer_id uuid REFERENCES user_profiles(id),
ADD COLUMN IF NOT EXISTS referral_code_used text,
ADD COLUMN IF NOT EXISTS referral_discount_applied numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS referral_commission_rate numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS referral_applied_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS referral_order_id uuid REFERENCES client_orders(id);

-- Add index for performance on referrer_id lookups
CREATE INDEX IF NOT EXISTS idx_customers_referrer_id ON customers(referrer_id);
CREATE INDEX IF NOT EXISTS idx_customers_referral_type ON customers(referral_type);
CREATE INDEX IF NOT EXISTS idx_customers_referral_code_used ON customers(referral_code_used);

-- Add comment to explain the new simplified approach
COMMENT ON COLUMN customers.referral_type IS 'Type of referral: PARTNER (business partner), CUSTOMER (customer-to-customer), INFLUENCER (social media), or ORGANIC (no referral)';
COMMENT ON COLUMN customers.referrer_id IS 'Links to user_profiles.id of the person who referred this customer (partner, customer, or influencer)';
COMMENT ON COLUMN customers.referral_code_used IS 'The specific referral code that was used to sign up';
COMMENT ON COLUMN customers.referral_discount_applied IS 'Discount amount applied to first order (in pence/cents)';
COMMENT ON COLUMN customers.referral_commission_rate IS 'Commission rate for the referrer (as percentage, e.g., 10.0 for 10%)';

-- Verify the changes
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'customers'
AND column_name IN ('referral_type', 'referrer_id', 'referral_code_used', 'referral_discount_applied', 'referral_commission_rate')
ORDER BY column_name;