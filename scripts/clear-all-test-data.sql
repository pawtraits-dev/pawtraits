-- =====================================================================================
-- COMPREHENSIVE TEST DATA CLEANUP - Clear all test orders, referrals, and commissions
-- =====================================================================================
-- This script removes all test data while preserving system configuration data

-- =============================================================================
-- STEP 1: Show current data counts before cleanup
-- =============================================================================
SELECT 
    'BEFORE CLEANUP' as status,
    'orders' as table_name,
    COUNT(*) as count,
    'Contains all test orders' as description
FROM orders
UNION ALL
SELECT 
    'BEFORE CLEANUP' as status,
    'order_items' as table_name,
    COUNT(*) as count,
    'Line items from test orders' as description
FROM order_items
UNION ALL
SELECT 
    'BEFORE CLEANUP' as status,
    'client_orders' as table_name,
    COUNT(*) as count,
    'Commission tracking records' as description
FROM client_orders
UNION ALL
SELECT 
    'BEFORE CLEANUP' as status,
    'referrals' as table_name,
    COUNT(*) as count,
    'Partner referral codes and tracking' as description
FROM referrals
UNION ALL
SELECT 
    'BEFORE CLEANUP' as status,
    'referral_analytics' as table_name,
    COUNT(*) as count,
    'Referral performance data' as description
FROM referral_analytics
UNION ALL
SELECT 
    'BEFORE CLEANUP' as status,
    'cost_snapshots' as table_name,
    COUNT(*) as count,
    'Order cost capture records' as description
FROM cost_snapshots
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cost_snapshots')
UNION ALL
SELECT 
    'BEFORE CLEANUP' as status,
    'gelato_webhooks' as table_name,
    COUNT(*) as count,
    'Gelato fulfillment webhook logs' as description
FROM gelato_webhooks
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gelato_webhooks')
ORDER BY table_name;

-- =============================================================================
-- STEP 2: Create backup tables (optional - uncomment if you want backups)
-- =============================================================================
-- CREATE TABLE backup_orders_$(date +%Y%m%d) AS SELECT * FROM orders;
-- CREATE TABLE backup_order_items_$(date +%Y%m%d) AS SELECT * FROM order_items;
-- CREATE TABLE backup_client_orders_$(date +%Y%m%d) AS SELECT * FROM client_orders;
-- CREATE TABLE backup_referrals_$(date +%Y%m%d) AS SELECT * FROM referrals;
-- CREATE TABLE backup_referral_analytics_$(date +%Y%m%d) AS SELECT * FROM referral_analytics;

-- =============================================================================
-- STEP 3: Clear all test data (order matters due to foreign key constraints)
-- =============================================================================

-- Clear cost tracking data first (references order_items)
DELETE FROM cost_snapshots WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cost_snapshots');

-- Clear Gelato webhook logs
DELETE FROM gelato_webhooks WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gelato_webhooks');

-- Clear order items (references orders)
DELETE FROM order_items;

-- Clear commission tracking (references orders via order_id or referrals)  
DELETE FROM client_orders;

-- Clear referral analytics (references referrals)
DELETE FROM referral_analytics;

-- Clear all orders (main transaction records)
DELETE FROM orders;

-- Clear all referrals (partner tracking data)
DELETE FROM referrals;

-- =============================================================================
-- STEP 4: Reset any auto-incrementing sequences if they exist
-- =============================================================================
-- Note: Most tables use UUIDs, but reset any sequences that might exist

-- Reset order number sequence if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name LIKE '%order%') THEN
        -- This would reset order number generation, but we use timestamps so not needed
        NULL;
    END IF;
END $$;

-- =============================================================================
-- STEP 5: Clear any cached/derived data
-- =============================================================================

-- Clear user interactions related to purchases (keep likes/shares for engagement)
DELETE FROM user_interactions WHERE interaction_type = 'purchase';

-- Clear any QR code tracking data from referrals
DELETE FROM qr_code_tracking WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'qr_code_tracking');

-- =============================================================================
-- STEP 6: Show final counts to verify cleanup
-- =============================================================================
SELECT 
    'AFTER CLEANUP' as status,
    'orders' as table_name,
    COUNT(*) as count,
    CASE WHEN COUNT(*) = 0 THEN 'SUCCESS - All cleared' ELSE 'WARNING - Data remains' END as result
FROM orders
UNION ALL
SELECT 
    'AFTER CLEANUP' as status,
    'order_items' as table_name,
    COUNT(*) as count,
    CASE WHEN COUNT(*) = 0 THEN 'SUCCESS - All cleared' ELSE 'WARNING - Data remains' END as result
FROM order_items
UNION ALL
SELECT 
    'AFTER CLEANUP' as status,
    'client_orders' as table_name,
    COUNT(*) as count,
    CASE WHEN COUNT(*) = 0 THEN 'SUCCESS - All cleared' ELSE 'WARNING - Data remains' END as result
FROM client_orders
UNION ALL
SELECT 
    'AFTER CLEANUP' as status,
    'referrals' as table_name,
    COUNT(*) as count,
    CASE WHEN COUNT(*) = 0 THEN 'SUCCESS - All cleared' ELSE 'WARNING - Data remains' END as result
FROM referrals
UNION ALL
SELECT 
    'AFTER CLEANUP' as status,
    'referral_analytics' as table_name,
    COUNT(*) as count,
    CASE WHEN COUNT(*) = 0 THEN 'SUCCESS - All cleared' ELSE 'WARNING - Data remains' END as result
FROM referral_analytics
UNION ALL
SELECT 
    'AFTER CLEANUP' as status,
    'user_interactions (purchases)' as table_name,
    COUNT(*) as count,
    CASE WHEN COUNT(*) = 0 THEN 'SUCCESS - All cleared' ELSE 'INFO - Some remain' END as result
FROM user_interactions WHERE interaction_type = 'purchase'
ORDER BY table_name;

-- =============================================================================
-- STEP 7: Verification queries
-- =============================================================================

-- Show what data remains (should be system/config data only)
SELECT 
    'PRESERVED DATA' as category,
    'user_profiles' as table_name,
    COUNT(*) as count,
    'Admin and partner accounts preserved' as description
FROM user_profiles
UNION ALL
SELECT 
    'PRESERVED DATA' as category,
    'partners' as table_name,
    COUNT(*) as count,
    'Partner business profiles preserved' as description
FROM partners
UNION ALL
SELECT 
    'PRESERVED DATA' as category,
    'customers' as table_name,
    COUNT(*) as count,
    'Customer profiles preserved' as description
FROM customers
UNION ALL
SELECT 
    'PRESERVED DATA' as category,
    'image_catalog' as table_name,
    COUNT(*) as count,
    'AI generated images preserved' as description
FROM image_catalog
UNION ALL
SELECT 
    'PRESERVED DATA' as category,
    'products' as table_name,
    COUNT(*) as count,
    'Product catalog preserved' as description
FROM products
UNION ALL
SELECT 
    'PRESERVED DATA' as category,
    'breeds/themes/styles' as table_name,
    (SELECT COUNT(*) FROM breeds) + (SELECT COUNT(*) FROM themes) + (SELECT COUNT(*) FROM styles) as count,
    'AI generation metadata preserved' as description
ORDER BY table_name;

-- Final completion message
DO $$
BEGIN
    RAISE NOTICE '✅ Test data cleanup completed successfully!';
    RAISE NOTICE '📋 All orders, referrals, and commission data has been removed';
    RAISE NOTICE '🔒 System configuration and AI catalog data preserved';
    RAISE NOTICE '🚀 Ready for fresh production orders!';
END $$;