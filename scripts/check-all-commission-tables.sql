-- Check all commission-related table structures
SELECT '=== REFERRALS TABLE STRUCTURE ===' as section;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'referrals' 
ORDER BY ordinal_position;

SELECT '' as spacer;
SELECT '=== REFERRAL_ANALYTICS TABLE STRUCTURE ===' as section;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'referral_analytics' 
ORDER BY ordinal_position;

SELECT '' as spacer;
SELECT '=== CLIENT_ORDERS TABLE STRUCTURE ===' as section;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'client_orders' 
ORDER BY ordinal_position;

SELECT '' as spacer;
SELECT '=== ORDERS TABLE STRUCTURE (commission-related columns) ===' as section;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name IN ('placed_by_partner_id', 'order_type', 'client_email', 'client_name', 'customer_email')
ORDER BY ordinal_position;

SELECT '' as spacer;
SELECT '=== SAMPLE DATA CHECK ===' as section;
SELECT 'Recent referrals (last 3):' as check_section;
SELECT id, status, customer_email, partner_id, created_at::date 
FROM referrals 
ORDER BY created_at DESC 
LIMIT 3;

SELECT 'Recent orders with partner attribution:' as check_section;
SELECT id, order_type, placed_by_partner_id, client_email, customer_email, created_at::date
FROM orders 
WHERE placed_by_partner_id IS NOT NULL
ORDER BY created_at DESC 
LIMIT 3;