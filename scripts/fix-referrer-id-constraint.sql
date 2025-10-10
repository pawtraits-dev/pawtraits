-- ========================================
-- FIX REFERRER_ID FOREIGN KEY CONSTRAINT
-- ========================================
-- Problem: customers.referrer_id currently references user_profiles(id)
-- But for customer-to-customer referrals, it should reference customers(id)
--
-- Solution: Drop the user_profiles FK constraint
-- The referrer_id will be used polymorphically:
-- - For PARTNER referrals: points to user_profiles.id or partners.id
-- - For CUSTOMER referrals: points to customers.id
-- - For INFLUENCER referrals: points to user_profiles.id or influencers.id
--
-- We remove the FK constraint to allow flexibility
-- Application logic will maintain referential integrity

-- 1. Drop the existing foreign key constraint
ALTER TABLE customers
DROP CONSTRAINT IF EXISTS customers_referrer_id_fkey;

-- 2. Add comments for documentation
COMMENT ON COLUMN customers.referrer_id IS
  'Polymorphic reference to referrer. Points to: ' ||
  'user_profiles.id or partners.id (for PARTNER referrals), ' ||
  'customers.id (for CUSTOMER referrals), ' ||
  'user_profiles.id or influencers.id (for INFLUENCER referrals). ' ||
  'No FK constraint - application enforces referential integrity.';

-- 3. Add index for performance (since we're querying by referrer_id)
CREATE INDEX IF NOT EXISTS idx_customers_referrer_id ON customers(referrer_id);

-- 4. Add index for referral_type + referrer_id combination (for attribution queries)
CREATE INDEX IF NOT EXISTS idx_customers_referral_type_referrer ON customers(referral_type, referrer_id);

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Successfully removed FK constraint on customers.referrer_id';
  RAISE NOTICE 'The field is now polymorphic and can reference different tables based on referral_type';
END
$$;
