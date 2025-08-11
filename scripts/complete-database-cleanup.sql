-- COMPLETE DATABASE CLEANUP - Removes ALL test data including auth records
-- Preserves: Admin users, static content (breeds, themes, styles, etc.)
-- Removes: Partners, customers, referrals, orders, pets + their auth records

-- IMPORTANT: This script requires SUPABASE SERVICE ROLE permissions
-- Run this through the Supabase SQL Editor

BEGIN;

-- ============================================================================
-- STEP 1: SAFETY CHECKS AND BACKUPS
-- ============================================================================

-- Show what we're starting with
SELECT 'BEFORE CLEANUP - Current counts:' as stage;
SELECT 'auth.users' as table_name, COUNT(*) as count FROM auth.users
UNION ALL
SELECT 'user_profiles' as table_name, COUNT(*) as count FROM user_profiles
UNION ALL
SELECT 'partners' as table_name, COUNT(*) as count FROM partners
UNION ALL
SELECT 'customers' as table_name, COUNT(*) as count FROM customers
UNION ALL
SELECT 'referrals' as table_name, COUNT(*) as count FROM referrals
UNION ALL
SELECT 'pets' as table_name, COUNT(*) as count FROM pets
UNION ALL
SELECT 'orders' as table_name, COUNT(*) as count FROM orders
UNION ALL
SELECT 'client_orders' as table_name, COUNT(*) as count FROM client_orders
ORDER BY table_name;

-- Create backup tables (optional - uncomment if you want backups)
-- CREATE TABLE backup_auth_users AS SELECT * FROM auth.users WHERE id NOT IN (SELECT user_id FROM user_profiles WHERE user_type = 'admin');
-- CREATE TABLE backup_user_profiles AS SELECT * FROM user_profiles WHERE user_type != 'admin';
-- CREATE TABLE backup_partners AS SELECT * FROM partners;
-- CREATE TABLE backup_customers AS SELECT * FROM customers;
-- CREATE TABLE backup_referrals AS SELECT * FROM referrals;
-- CREATE TABLE backup_orders AS SELECT * FROM orders;
-- CREATE TABLE backup_client_orders AS SELECT * FROM client_orders;
-- CREATE TABLE backup_pets AS SELECT * FROM pets;

-- Get admin user IDs to preserve (CRITICAL)
CREATE TEMP TABLE admin_user_ids AS 
SELECT user_id FROM user_profiles WHERE user_type = 'admin';

-- SAFETY: Show admin users that will be preserved
SELECT 'ADMIN USERS TO PRESERVE:' as check;
SELECT 
    au.id,
    au.email,
    up.first_name,
    up.last_name,
    'WILL BE PRESERVED' as status
FROM auth.users au
JOIN user_profiles up ON au.id = up.user_id
WHERE up.user_type = 'admin';

-- Show non-admin users that will be deleted
SELECT 'NON-ADMIN USERS TO BE DELETED:' as check;
SELECT 
    au.id,
    au.email,
    COALESCE(up.user_type, 'no_profile') as user_type,
    'WILL BE DELETED' as status
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.user_id
WHERE au.id NOT IN (SELECT user_id FROM admin_user_ids)
ORDER BY au.created_at;

-- ============================================================================
-- STEP 2: CLEAR APPLICATION DATA (in dependency order)
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

-- Clear pets (references customers via user_id)
DELETE FROM pets;

-- Clear non-admin user profiles (this removes foreign key references)
DELETE FROM user_profiles 
WHERE user_type != 'admin';

-- Clear partner_id and customer_id references from admin profiles
UPDATE user_profiles 
SET partner_id = NULL, customer_id = NULL 
WHERE user_type = 'admin';

-- Now safely clear customers and partners
DELETE FROM customers;
DELETE FROM partners;

-- ============================================================================
-- STEP 3: CLEAR AUTH RECORDS (preserving admins)
-- ============================================================================

-- Delete non-admin auth users
DELETE FROM auth.users 
WHERE id NOT IN (SELECT user_id FROM admin_user_ids);

-- ============================================================================
-- STEP 4: VERIFICATION
-- ============================================================================

SELECT 'AFTER CLEANUP - Final counts:' as stage;

-- Show remaining user data (should only be admins)
SELECT 'USER DATA REMAINING:' as category;
SELECT 
    'auth.users' as table_name,
    COUNT(*) as count,
    'admin_only' as expected
FROM auth.users
UNION ALL
SELECT 
    'user_profiles' as table_name,
    COUNT(*) as count,
    'admin_only' as expected
FROM user_profiles
UNION ALL
SELECT 
    'partners' as table_name,
    COUNT(*) as count,
    'should_be_0' as expected
FROM partners
UNION ALL
SELECT 
    'customers' as table_name,
    COUNT(*) as count,
    'should_be_0' as expected
FROM customers
UNION ALL
SELECT 
    'referrals' as table_name,
    COUNT(*) as count,
    'should_be_0' as expected
FROM referrals
UNION ALL
SELECT 
    'pets' as table_name,
    COUNT(*) as count,
    'should_be_0' as expected
FROM pets
UNION ALL
SELECT 
    'orders' as table_name,
    COUNT(*) as count,
    'should_be_0' as expected
FROM orders
UNION ALL
SELECT 
    'client_orders' as table_name,
    COUNT(*) as count,
    'should_be_0' as expected
FROM client_orders
ORDER BY table_name;

-- Verify admin users are intact
SELECT 'REMAINING ADMIN USERS:' as verification;
SELECT 
    au.id,
    au.email,
    up.first_name,
    up.last_name,
    up.user_type,
    'PRESERVED' as status
FROM auth.users au
JOIN user_profiles up ON au.id = up.user_id
WHERE up.user_type = 'admin';

-- Show preserved static/content data
SELECT 'STATIC DATA PRESERVED:' as category;
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

-- Clean up temp table
DROP TABLE admin_user_ids;

SELECT 'SUCCESS: Complete database cleanup finished!' as message;
SELECT 'Admin users and static content preserved.' as preserved;
SELECT 'All test data and auth records removed.' as removed;
SELECT 'Database is ready for fresh testing.' as ready;

COMMIT;

-- ============================================================================
-- WHAT THIS SCRIPT DOES:
-- ============================================================================
-- ✅ REMOVES:
--    - All partner accounts and their auth records
--    - All customer accounts and their auth records  
--    - All referrals and analytics
--    - All orders (both orders and client_orders)
--    - All pets
--    - All commission payments
--    - All non-admin user_profiles
--    - All non-admin auth.users records
--
-- ✅ PRESERVES:
--    - Admin users (both user_profiles AND auth.users)
--    - All static content (breeds, themes, styles, formats, coats)
--    - All image catalog data
--    - All product and pricing data
--    - All media definitions
--
-- ✅ SAFETY FEATURES:
--    - Shows exactly what will be preserved vs deleted
--    - Handles all foreign key constraints properly
--    - Comprehensive verification at the end
--    - Optional backup table creation
-- ============================================================================