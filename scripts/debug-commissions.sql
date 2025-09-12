-- COMMISSION SYSTEM DEBUG REPORT
-- Run this script to investigate commission creation and display issues

SELECT '🔍 COMMISSION SYSTEM DEBUG REPORT' as debug_report;
SELECT '' as spacer;

-- 1. Check if client_orders table exists and has data
SELECT '1. Checking client_orders table (commission records):' as section;

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'client_orders') THEN
        RAISE NOTICE '✅ client_orders table exists';
    ELSE
        RAISE NOTICE '❌ client_orders table does NOT exist!';
    END IF;
END $$;

SELECT 
    COUNT(*) as total_commission_records,
    COUNT(CASE WHEN commission_paid = false THEN 1 END) as unpaid_commissions,
    SUM(commission_amount) as total_commission_amount,
    AVG(commission_rate) as avg_commission_rate
FROM client_orders;

SELECT '' as spacer;
SELECT 'Sample commission records:' as section;
SELECT 
    LEFT(id::text, 8) as id_short,
    client_email,
    LEFT(partner_id::text, 8) as partner_id_short,
    commission_amount,
    commission_rate,
    commission_paid,
    order_type,
    created_at::date
FROM client_orders 
ORDER BY created_at DESC 
LIMIT 5;

SELECT '' as spacer;
SELECT '2. Checking recent orders with partner attribution:' as section;
SELECT 
    COUNT(*) as total_partner_orders,
    COUNT(CASE WHEN order_type = 'partner_for_client' THEN 1 END) as partner_for_client_orders,
    COUNT(CASE WHEN order_type = 'partner' THEN 1 END) as partner_orders
FROM orders 
WHERE placed_by_partner_id IS NOT NULL;

SELECT '' as spacer;
SELECT 'Recent partner orders:' as section;
SELECT 
    LEFT(id::text, 8) as id_short,
    order_number,
    order_type,
    LEFT(placed_by_partner_id::text, 8) as partner_id_short,
    client_email,
    client_name,
    total_amount,
    created_at::date
FROM orders 
WHERE placed_by_partner_id IS NOT NULL
ORDER BY created_at DESC 
LIMIT 5;

SELECT '' as spacer;
SELECT '3. Checking referrals table for commission tracking:' as section;
SELECT 
    COUNT(*) as total_applied_referrals,
    SUM(commission_amount) as total_referral_commissions,
    SUM(order_value) as total_referral_order_value
FROM referrals 
WHERE status = 'applied';

SELECT '' as spacer;
SELECT 'Applied referrals:' as section;
SELECT 
    LEFT(id::text, 8) as id_short,
    client_email,
    LEFT(partner_id::text, 8) as partner_id_short,
    commission_amount,
    order_value,
    purchased_at::date
FROM referrals 
WHERE status = 'applied'
ORDER BY purchased_at DESC 
LIMIT 5;

SELECT '' as spacer;
SELECT '4. Cross-checking: Orders vs Commission Records' as section;
WITH partner_orders AS (
    SELECT id, order_number, order_type, placed_by_partner_id
    FROM orders 
    WHERE placed_by_partner_id IS NOT NULL
    ORDER BY created_at DESC 
    LIMIT 10
),
commission_check AS (
    SELECT 
        po.id,
        po.order_number,
        po.order_type,
        co.id IS NOT NULL as has_commission,
        co.commission_amount,
        co.commission_rate
    FROM partner_orders po
    LEFT JOIN client_orders co ON co.order_id = po.id
)
SELECT 
    LEFT(id::text, 8) as order_id_short,
    order_number,
    order_type,
    CASE 
        WHEN has_commission THEN '✅ Has commission (' || commission_amount || ' @ ' || commission_rate || '%)'
        ELSE '❌ Missing commission'
    END as commission_status
FROM commission_check;

SELECT '' as spacer;
SELECT '5. Checking partners table for commission rates:' as section;
SELECT 
    COUNT(*) as total_partners,
    COUNT(CASE WHEN commission_rate IS NOT NULL THEN 1 END) as partners_with_commission_rate,
    COUNT(CASE WHEN lifetime_commission_rate IS NOT NULL THEN 1 END) as partners_with_lifetime_rate,
    AVG(commission_rate) as avg_commission_rate,
    AVG(lifetime_commission_rate) as avg_lifetime_rate
FROM partners;

SELECT '' as spacer;
SELECT 'Partner commission rates:' as section;
SELECT 
    LEFT(id::text, 8) as id_short,
    COALESCE(business_name, email) as name,
    commission_rate,
    lifetime_commission_rate
FROM partners 
LIMIT 5;

SELECT '' as spacer;
SELECT '📋 COMMISSION SYSTEM SUMMARY:' as section;
SELECT '' as spacer;

-- Final summary query
WITH stats AS (
    SELECT 
        (SELECT COUNT(*) FROM client_orders) as commission_records,
        (SELECT COUNT(*) FROM orders WHERE placed_by_partner_id IS NOT NULL) as partner_orders,
        (SELECT COUNT(*) FROM referrals WHERE status = 'applied') as applied_referrals,
        (SELECT COUNT(*) FROM partners WHERE commission_rate IS NOT NULL) as partners_with_rates
)
SELECT 
    CASE WHEN commission_records > 0 THEN '✅' ELSE '❌' END || ' Commission Records: ' || commission_records as commission_status,
    CASE WHEN partner_orders > 0 THEN '✅' ELSE '❌' END || ' Partner Orders: ' || partner_orders as partner_order_status,
    CASE WHEN applied_referrals > 0 THEN '✅' ELSE '❌' END || ' Applied Referrals: ' || applied_referrals as referral_status,
    CASE WHEN partners_with_rates > 0 THEN '✅' ELSE '❌' END || ' Partners with Rates: ' || partners_with_rates as partner_rates_status
FROM stats;

SELECT '' as spacer;
SELECT 'DIAGNOSIS:' as section;
SELECT 'If commission records = 0 but partner orders > 0, check webhook logs for commission creation errors.' as diagnosis_1;
SELECT 'If commission records > 0 but not visible in UI, check commission display APIs and components.' as diagnosis_2;