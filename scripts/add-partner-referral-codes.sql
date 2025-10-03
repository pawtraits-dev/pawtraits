-- Migration: Add personal_referral_code to partners table and create indexes
-- Purpose: Allow partners to have their own referral codes independent of pre-registration codes
-- Date: 2025-10-03

-- Add personal_referral_code column to partners table
-- This allows partners who signed up organically (without pre-reg codes) to have referral codes
ALTER TABLE public.partners
ADD COLUMN IF NOT EXISTS personal_referral_code character varying UNIQUE;

-- Add comment explaining the field
COMMENT ON COLUMN public.partners.personal_referral_code IS
'Personal referral code for partners. Used for organic signups or as fallback when no pre-registration code exists.';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_partners_personal_referral_code
ON public.partners(personal_referral_code)
WHERE personal_referral_code IS NOT NULL;

-- Create index on customer_referrals for faster partner lookups
CREATE INDEX IF NOT EXISTS idx_customer_referrals_referrer_customer_id
ON public.customer_referrals(referrer_customer_id);

-- Create index on customers personal_referral_code for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_personal_referral_code
ON public.customers(personal_referral_code)
WHERE personal_referral_code IS NOT NULL;

-- Create index on pre_registration_codes partner_id for faster partner code lookups
CREATE INDEX IF NOT EXISTS idx_pre_registration_codes_partner_id
ON public.pre_registration_codes(partner_id)
WHERE partner_id IS NOT NULL;

-- Verify the changes
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully';
  RAISE NOTICE 'Partners table now has personal_referral_code column';
  RAISE NOTICE 'Indexes created for faster referral code lookups';
END $$;
