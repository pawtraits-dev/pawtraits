-- Clear all test data while preserving static content and admin users
-- Run this script to start fresh with a clean database

BEGIN;

-- Create a backup of what we're about to delete (optional safety measure)
-- Uncomment these lines if you want backups before deletion
-- CREATE TABLE backup_partners AS SELECT * FROM partners;
-- CREATE TABLE backup_customers AS SELECT * FROM customers;
-- CREATE TABLE backup_referrals AS SELECT * FROM referrals;
-- CREATE TABLE backup_orders AS SELECT * FROM orders;
-- CREATE TABLE backup_client_orders AS SELECT * FROM client_orders;
-- CREATE TABLE backup_pets AS SELECT * FROM pets;

-- ============================================================================
-- STEP 1: Clear transactional/user data (in dependency order)
-- ============================================================================

-- Clear referral analytics first (references referrals)
DELETE FROM referral_analytics;
TRUNCATE TABLE referral_analytics RESTART IDENTITY CASCADE;

-- Clear commission payments (references partners)
DELETE FROM commission_payments;
TRUNCATE TABLE commission_payments RESTART IDENTITY CASCADE;

-- Clear orders and related data
DELETE FROM client_orders;
TRUNCATE TABLE client_orders RESTART IDENTITY CASCADE;

DELETE FROM orders;
TRUNCATE TABLE orders RESTART IDENTITY CASCADE;

-- Clear referrals (references partners)
DELETE FROM referrals;
TRUNCATE TABLE referrals RESTART IDENTITY CASCADE;

-- Clear pets (references customers via user_id)
DELETE FROM pets;
TRUNCATE TABLE pets RESTART IDENTITY CASCADE;

-- Clear customers
DELETE FROM customers;
TRUNCATE TABLE customers RESTART IDENTITY CASCADE;

-- Clear partners
DELETE FROM partners;
TRUNCATE TABLE partners RESTART IDENTITY CASCADE;

-- Clear user profiles but keep admin users
DELETE FROM user_profiles 
WHERE user_type != 'admin';

-- ============================================================================
-- STEP 2: Clean up auth.users but preserve admin users
-- ============================================================================

-- Delete auth users that are not admins
-- First get admin user IDs to preserve
CREATE TEMP TABLE admin_user_ids AS 
SELECT user_id FROM user_profiles WHERE user_type = 'admin';

-- Delete non-admin auth users (this requires service role access)
-- Note: This may need to be run separately with service role permissions
-- DELETE FROM auth.users 
-- WHERE id NOT IN (SELECT user_id FROM admin_user_ids);

-- ============================================================================
-- STEP 3: Reset sequences for clean IDs
-- ============================================================================

-- Reset any sequences that might have been affected
-- (Most tables use UUIDs, but some might use serial IDs)
-- ALTER SEQUENCE IF EXISTS referral_analytics_id_seq RESTART WITH 1;

-- ============================================================================
-- VERIFICATION: Show what's left
-- ============================================================================

SELECT 'Data clearing completed. Remaining counts:' as status;

SELECT 
    'user_profiles' as table_name,
    user_type,
    COUNT(*) as remaining_count
FROM user_profiles 
GROUP BY user_type
UNION ALL
SELECT 
    'partners' as table_name,
    'all' as user_type,
    COUNT(*) as remaining_count
FROM partners
UNION ALL
SELECT 
    'customers' as table_name,
    'all' as user_type,
    COUNT(*) as remaining_count
FROM customers
UNION ALL
SELECT 
    'referrals' as table_name,
    'all' as user_type,
    COUNT(*) as remaining_count
FROM referrals
UNION ALL
SELECT 
    'pets' as table_name,
    'all' as user_type,
    COUNT(*) as remaining_count
FROM pets
UNION ALL
SELECT 
    'orders' as table_name,
    'all' as user_type,
    COUNT(*) as remaining_count
FROM orders
UNION ALL
SELECT 
    'client_orders' as table_name,
    'all' as user_type,
    COUNT(*) as remaining_count
FROM client_orders
ORDER BY table_name, user_type;

-- Show preserved static data counts
SELECT 'Static/content data preserved:' as status;

SELECT 
    'breeds' as table_name,
    COUNT(*) as count
FROM breeds
UNION ALL
SELECT 
    'themes' as table_name,
    COUNT(*) as count
FROM themes
UNION ALL
SELECT 
    'styles' as table_name,
    COUNT(*) as count
FROM styles
UNION ALL
SELECT 
    'formats' as table_name,
    COUNT(*) as count
FROM formats
UNION ALL
SELECT 
    'coats' as table_name,
    COUNT(*) as count
FROM coats
UNION ALL
SELECT 
    'image_catalog' as table_name,
    COUNT(*) as count
FROM image_catalog
UNION ALL
SELECT 
    'products' as table_name,
    COUNT(*) as count
FROM products
UNION ALL
SELECT 
    'product_pricing' as table_name,
    COUNT(*) as count
FROM product_pricing
UNION ALL
SELECT 
    'media' as table_name,
    COUNT(*) as count
FROM media
ORDER BY table_name;

COMMIT;

-- ============================================================================
-- NOTES:
-- ============================================================================
-- 1. This script preserves:
--    - All admin users and their profiles
--    - All static content (breeds, themes, styles, formats, coats)
--    - All catalog/gallery images
--    - All product and pricing data
--    - All media definitions
--
-- 2. This script removes:
--    - All partner accounts and data
--    - All customer accounts and data
--    - All referrals and analytics
--    - All orders (both orders and client_orders tables)
--    - All pets
--    - All commission payments
--
-- 3. The auth.users cleanup is commented out because it requires
--    service role permissions. You may need to run that separately.
--
-- 4. After running this, you can test the partner signup flow,
--    customer signup flow, and referral system with clean data.
-- ============================================================================