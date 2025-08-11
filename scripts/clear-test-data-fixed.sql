-- Clear all test data while preserving static content and admin users
-- FIXED VERSION: Handles foreign key constraints properly

BEGIN;

-- Create a backup of what we're about to delete (optional safety measure)
-- Uncomment these lines if you want backups before deletion
-- CREATE TABLE backup_partners AS SELECT * FROM partners;
-- CREATE TABLE backup_customers AS SELECT * FROM customers;
-- CREATE TABLE backup_referrals AS SELECT * FROM referrals;
-- CREATE TABLE backup_orders AS SELECT * FROM orders;
-- CREATE TABLE backup_client_orders AS SELECT * FROM client_orders;
-- CREATE TABLE backup_pets AS SELECT * FROM pets;
-- CREATE TABLE backup_user_profiles AS SELECT * FROM user_profiles WHERE user_type != 'admin';

-- ============================================================================
-- STEP 1: Clear transactional/user data (in correct dependency order)
-- ============================================================================

-- Clear referral analytics first (references referrals)
DELETE FROM referral_analytics;

-- Clear commission payments (references partners)
DELETE FROM commission_payments;

-- Clear orders and related data
DELETE FROM client_orders;
DELETE FROM orders;

-- Clear referrals (references partners)
DELETE FROM referrals;

-- Clear pets (references customers via user_id or customer relationships)
DELETE FROM pets;

-- CRITICAL: Clear user_profiles BEFORE customers/partners
-- This removes the foreign key references first
DELETE FROM user_profiles 
WHERE user_type != 'admin';

-- Now we can safely clear customers and partners
DELETE FROM customers;
DELETE FROM partners;

-- ============================================================================
-- STEP 2: Reset any auto-increment sequences if needed
-- ============================================================================

-- Most tables use UUIDs so this may not be necessary, but included for completeness
-- ALTER SEQUENCE IF EXISTS some_sequence_name RESTART WITH 1;

-- ============================================================================
-- STEP 3: Clean up auth.users but preserve admin users (OPTIONAL - needs service role)
-- ============================================================================

-- This section requires service role permissions and may need to be run separately
-- 
-- -- First, get admin user IDs to preserve
-- CREATE TEMP TABLE admin_user_ids AS 
-- SELECT user_id FROM user_profiles WHERE user_type = 'admin';
-- 
-- -- Delete non-admin auth users
-- DELETE FROM auth.users 
-- WHERE id NOT IN (SELECT user_id FROM admin_user_ids);
-- 
-- DROP TABLE admin_user_ids;

-- ============================================================================
-- VERIFICATION: Show what's left
-- ============================================================================

SELECT 'Data clearing completed successfully!' as status;

-- Show remaining user data
SELECT 
    'USER DATA REMAINING:' as category,
    '' as table_name,
    '' as type_or_status,
    NULL as count;

SELECT 
    '' as category,
    'user_profiles' as table_name,
    user_type as type_or_status,
    COUNT(*)::text as count
FROM user_profiles 
GROUP BY user_type
UNION ALL
SELECT 
    '' as category,
    'partners' as table_name,
    'total' as type_or_status,
    COUNT(*)::text as count
FROM partners
UNION ALL
SELECT 
    '' as category,
    'customers' as table_name,
    'total' as type_or_status,
    COUNT(*)::text as count
FROM customers
UNION ALL
SELECT 
    '' as category,
    'referrals' as table_name,
    'total' as type_or_status,
    COUNT(*)::text as count
FROM referrals
UNION ALL
SELECT 
    '' as category,
    'pets' as table_name,
    'total' as type_or_status,
    COUNT(*)::text as count
FROM pets
UNION ALL
SELECT 
    '' as category,
    'orders' as table_name,
    'total' as type_or_status,
    COUNT(*)::text as count
FROM orders
UNION ALL
SELECT 
    '' as category,
    'client_orders' as table_name,
    'total' as type_or_status,
    COUNT(*)::text as count
FROM client_orders;

-- Show preserved static/content data
SELECT 
    'STATIC DATA PRESERVED:' as category,
    '' as table_name,
    '' as type_or_status,
    NULL as count;

SELECT 
    '' as category,
    'breeds' as table_name,
    'active/total' as type_or_status,
    (COUNT(CASE WHEN is_active THEN 1 END)::text || '/' || COUNT(*)::text) as count
FROM breeds
UNION ALL
SELECT 
    '' as category,
    'themes' as table_name,
    'active/total' as type_or_status,
    (COUNT(CASE WHEN is_active THEN 1 END)::text || '/' || COUNT(*)::text) as count
FROM themes
UNION ALL
SELECT 
    '' as category,
    'styles' as table_name,
    'active/total' as type_or_status,
    (COUNT(CASE WHEN is_active THEN 1 END)::text || '/' || COUNT(*)::text) as count
FROM styles
UNION ALL
SELECT 
    '' as category,
    'formats' as table_name,
    'active/total' as type_or_status,
    (COUNT(CASE WHEN is_active THEN 1 END)::text || '/' || COUNT(*)::text) as count
FROM formats
UNION ALL
SELECT 
    '' as category,
    'coats' as table_name,
    'active/total' as type_or_status,
    (COUNT(CASE WHEN is_active THEN 1 END)::text || '/' || COUNT(*)::text) as count
FROM coats
UNION ALL
SELECT 
    '' as category,
    'image_catalog' as table_name,
    'public/total' as type_or_status,
    (COUNT(CASE WHEN is_public THEN 1 END)::text || '/' || COUNT(*)::text) as count
FROM image_catalog
UNION ALL
SELECT 
    '' as category,
    'products' as table_name,
    'active/total' as type_or_status,
    (COUNT(CASE WHEN is_active THEN 1 END)::text || '/' || COUNT(*)::text) as count
FROM products
UNION ALL
SELECT 
    '' as category,
    'product_pricing' as table_name,
    'total' as type_or_status,
    COUNT(*)::text as count
FROM product_pricing
UNION ALL
SELECT 
    '' as category,
    'media' as table_name,
    'active/total' as type_or_status,
    (COUNT(CASE WHEN is_active THEN 1 END)::text || '/' || COUNT(*)::text) as count
FROM media
ORDER BY category DESC, table_name;

COMMIT;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
SELECT 'Database cleanup completed successfully!' as message,
       'You can now test partner signup, referrals, and customer flows with clean data.' as next_steps;