-- Clear all test data while preserving static content and admin users
-- FINAL VERSION: Properly handles ALL foreign key constraints

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

-- CRITICAL FIX: Clear foreign key references in user_profiles BEFORE deleting referenced tables
-- Step 1: Delete non-admin user profiles entirely
DELETE FROM user_profiles 
WHERE user_type != 'admin';

-- Step 2: Clear partner_id and customer_id references from remaining admin profiles
-- This ensures no foreign key constraints block the deletion of partners/customers
UPDATE user_profiles 
SET partner_id = NULL, customer_id = NULL 
WHERE user_type = 'admin';

-- Now we can safely delete customers and partners without foreign key violations
DELETE FROM customers;
DELETE FROM partners;

-- ============================================================================
-- STEP 2: Clean up auth.users but preserve admin users (OPTIONAL - needs service role)
-- ============================================================================

-- This section requires service role permissions and may need to be run separately
-- 
-- -- First, get admin user IDs to preserve
-- CREATE TEMP TABLE admin_user_ids AS 
-- SELECT user_id FROM user_profiles WHERE user_type = 'admin';
-- 
-- -- Delete non-admin auth users from auth.users table
-- DELETE FROM auth.users 
-- WHERE id NOT IN (SELECT user_id FROM admin_user_ids);
-- 
-- DROP TABLE admin_user_ids;

-- ============================================================================
-- VERIFICATION: Show what's left and what was preserved
-- ============================================================================

SELECT 'Database cleanup completed successfully!' as status;

-- Show remaining user data (should only be admins)
SELECT 
    'USER DATA REMAINING:' as section,
    '===================' as separator;

SELECT 
    'user_profiles' as table_name,
    user_type,
    COUNT(*) as count,
    CASE 
        WHEN partner_id IS NOT NULL THEN 'has partner_id refs'
        WHEN customer_id IS NOT NULL THEN 'has customer_id refs' 
        ELSE 'no refs'
    END as reference_status
FROM user_profiles 
GROUP BY user_type, 
         CASE 
             WHEN partner_id IS NOT NULL THEN 'has partner_id refs'
             WHEN customer_id IS NOT NULL THEN 'has customer_id refs' 
             ELSE 'no refs'
         END;

-- Count remaining records in cleared tables (should all be 0)
SELECT 
    'CLEARED TABLES (should be 0):' as section,
    '=============================' as separator;

SELECT 'partners' as table_name, COUNT(*) as remaining_count FROM partners
UNION ALL
SELECT 'customers' as table_name, COUNT(*) as remaining_count FROM customers  
UNION ALL
SELECT 'referrals' as table_name, COUNT(*) as remaining_count FROM referrals
UNION ALL
SELECT 'pets' as table_name, COUNT(*) as remaining_count FROM pets
UNION ALL
SELECT 'orders' as table_name, COUNT(*) as remaining_count FROM orders
UNION ALL
SELECT 'client_orders' as table_name, COUNT(*) as remaining_count FROM client_orders
UNION ALL
SELECT 'referral_analytics' as table_name, COUNT(*) as remaining_count FROM referral_analytics
UNION ALL
SELECT 'commission_payments' as table_name, COUNT(*) as remaining_count FROM commission_payments
ORDER BY table_name;

-- Show preserved static/content data
SELECT 
    'STATIC DATA PRESERVED:' as section,
    '======================' as separator;

SELECT 
    'breeds' as table_name,
    COUNT(CASE WHEN is_active THEN 1 END) as active_count,
    COUNT(*) as total_count
FROM breeds
UNION ALL
SELECT 
    'themes' as table_name,
    COUNT(CASE WHEN is_active THEN 1 END) as active_count,
    COUNT(*) as total_count
FROM themes
UNION ALL
SELECT 
    'styles' as table_name,
    COUNT(CASE WHEN is_active THEN 1 END) as active_count,
    COUNT(*) as total_count
FROM styles
UNION ALL
SELECT 
    'formats' as table_name,
    COUNT(CASE WHEN is_active THEN 1 END) as active_count,
    COUNT(*) as total_count
FROM formats
UNION ALL
SELECT 
    'coats' as table_name,
    COUNT(CASE WHEN is_active THEN 1 END) as active_count,
    COUNT(*) as total_count
FROM coats
UNION ALL
SELECT 
    'image_catalog' as table_name,
    COUNT(CASE WHEN is_public THEN 1 END) as active_count,
    COUNT(*) as total_count
FROM image_catalog
UNION ALL
SELECT 
    'products' as table_name,
    COUNT(CASE WHEN is_active THEN 1 END) as active_count,
    COUNT(*) as total_count
FROM products
UNION ALL
SELECT 
    'product_pricing' as table_name,
    COUNT(*) as active_count,
    COUNT(*) as total_count
FROM product_pricing
UNION ALL
SELECT 
    'media' as table_name,
    COUNT(CASE WHEN is_active THEN 1 END) as active_count,
    COUNT(*) as total_count
FROM media
ORDER BY table_name;

COMMIT;

-- ============================================================================
-- FINAL SUCCESS MESSAGE
-- ============================================================================
SELECT 
    'SUCCESS: Database has been cleared of all test data!' as message,
    'Admin users preserved with cleaned foreign key references.' as admin_status,
    'All static content (breeds, themes, styles, etc.) preserved.' as content_status,
    'Ready for fresh testing of partner/customer signup flows.' as next_steps;