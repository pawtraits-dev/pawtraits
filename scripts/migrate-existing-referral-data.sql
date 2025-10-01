-- Migrate existing customer referral data to simplified referral system
-- This script populates the new simplified referral fields for customers who already have referral data

BEGIN;

-- 1. Migrate customers referred by partners
UPDATE customers
SET
    referral_type = 'PARTNER',
    referrer_id = (
        SELECT up.id
        FROM user_profiles up
        WHERE up.partner_id = customers.referred_by_partner_id
    ),
    referral_code_used = COALESCE(customers.referral_code, ''),
    referral_applied_at = COALESCE(customers.referral_date, customers.created_at),
    referral_discount_applied = 1000, -- 10% discount in pence (£10.00)
    referral_commission_rate = 10.0   -- 10% commission rate
WHERE referred_by_partner_id IS NOT NULL
  AND referral_type IS NULL;

-- 2. Migrate customers with referral codes but no partner ID (customer-to-customer referrals)
UPDATE customers
SET
    referral_type = 'CUSTOMER',
    referrer_id = (
        SELECT c2.user_id
        FROM customers c2
        WHERE c2.personal_referral_code = customers.referral_code
        LIMIT 1
    ),
    referral_code_used = customers.referral_code,
    referral_applied_at = COALESCE(customers.referral_date, customers.created_at),
    referral_discount_applied = 500,  -- 5% discount for customer referrals
    referral_commission_rate = 0      -- Customers get credits, not commission
WHERE referral_code IS NOT NULL
  AND referred_by_partner_id IS NULL
  AND referral_type IS NULL;

-- 3. Try to find influencer referrals (if any customers used influencer codes)
UPDATE customers
SET
    referral_type = 'INFLUENCER',
    referrer_id = (
        SELECT up.id
        FROM user_profiles up
        JOIN influencer_referral_codes irc ON up.influencer_id = irc.influencer_id
        WHERE irc.code = customers.referral_code
        LIMIT 1
    ),
    referral_code_used = customers.referral_code,
    referral_applied_at = COALESCE(customers.referral_date, customers.created_at),
    referral_discount_applied = 1000, -- 10% discount
    referral_commission_rate = (
        SELECT i.commission_rate
        FROM influencers i
        JOIN influencer_referral_codes irc ON irc.influencer_id = i.id
        JOIN user_profiles up ON up.influencer_id = i.id
        WHERE irc.code = customers.referral_code
        LIMIT 1
    )
WHERE referral_code IS NOT NULL
  AND referred_by_partner_id IS NULL
  AND referral_type IS NULL;

-- 4. Set remaining customers with referral codes but no match as ORGANIC
-- (These might be invalid/expired codes)
UPDATE customers
SET
    referral_type = 'ORGANIC',
    referral_code_used = NULL,
    referral_applied_at = NULL
WHERE referral_code IS NOT NULL
  AND referral_type IS NULL;

-- 5. Set all remaining customers without any referral data as ORGANIC
UPDATE customers
SET referral_type = 'ORGANIC'
WHERE referral_type IS NULL;

-- 6. Create summary report of migration results
SELECT
    'Migration Summary' as report_type,
    referral_type,
    COUNT(*) as customer_count,
    COUNT(referrer_id) as customers_with_referrer,
    AVG(referral_discount_applied) as avg_discount_pence,
    AVG(referral_commission_rate) as avg_commission_rate
FROM customers
GROUP BY referral_type
ORDER BY customer_count DESC;

-- 7. Identify any data quality issues
SELECT
    'Data Quality Issues' as report_type,
    'Customers with referral_type but no referrer_id' as issue,
    COUNT(*) as count
FROM customers
WHERE referral_type IN ('PARTNER', 'CUSTOMER', 'INFLUENCER')
  AND referrer_id IS NULL
UNION ALL
SELECT
    'Data Quality Issues' as report_type,
    'Customers with referrer_id but no referral_type' as issue,
    COUNT(*) as count
FROM customers
WHERE referrer_id IS NOT NULL
  AND referral_type IS NULL;

COMMIT;

-- Final verification queries (run after migration)
/*
-- Verify partner referrals were migrated correctly
SELECT
    c.email,
    c.referral_type,
    up.first_name as referrer_name,
    c.referral_code_used,
    c.referral_discount_applied,
    c.referral_commission_rate
FROM customers c
JOIN user_profiles up ON up.id = c.referrer_id
WHERE c.referral_type = 'PARTNER'
LIMIT 10;

-- Verify customer referrals were migrated correctly
SELECT
    c.email,
    c.referral_type,
    c2.email as referrer_email,
    c.referral_code_used
FROM customers c
JOIN customers c2 ON c2.user_id = c.referrer_id
WHERE c.referral_type = 'CUSTOMER'
LIMIT 10;

-- Check overall distribution
SELECT referral_type, COUNT(*)
FROM customers
GROUP BY referral_type
ORDER BY COUNT(*) DESC;
*/