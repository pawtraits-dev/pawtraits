-- =====================================================================================
-- FINAL TEST DATA CLEANUP - Based on actual database schema
-- =====================================================================================
-- Clears all test orders, referrals, and commission data
-- Only operates on tables that exist in complete_schema.sql

-- =============================================================================
-- STEP 1: Show current data counts before cleanup
-- =============================================================================
SELECT 
    'BEFORE CLEANUP' as status,
    'orders' as table_name,
    COUNT(*) as count,
    'All test orders' as description
FROM orders
UNION ALL
SELECT 
    'BEFORE CLEANUP' as status,
    'order_items' as table_name,
    COUNT(*) as count,
    'Order line items' as description
FROM order_items
UNION ALL
SELECT 
    'BEFORE CLEANUP' as status,
    'referrals' as table_name,
    COUNT(*) as count,
    'Partner referrals' as description
FROM referrals
UNION ALL
SELECT 
    'BEFORE CLEANUP' as status,
    'client_orders' as table_name,
    COUNT(*) as count,
    'Commission tracking' as description
FROM client_orders
UNION ALL
SELECT 
    'BEFORE CLEANUP' as status,
    'referral_analytics' as table_name,
    COUNT(*) as count,
    'Referral events' as description
FROM referral_analytics
UNION ALL
SELECT 
    'BEFORE CLEANUP' as status,
    'commission_payments' as table_name,
    COUNT(*) as count,
    'Partner payments' as description
FROM commission_payments
UNION ALL
SELECT 
    'BEFORE CLEANUP' as status,
    'qr_code_tracking' as table_name,
    COUNT(*) as count,
    'QR code scans' as description
FROM qr_code_tracking
ORDER BY table_name;

-- =============================================================================
-- STEP 2: Clear data in foreign key dependency order
-- =============================================================================

-- Clear QR code tracking (no dependencies)
DELETE FROM qr_code_tracking;

-- Clear referral analytics (references referrals)
DELETE FROM referral_analytics;

-- Clear commission payments (references partners, but not orders)
DELETE FROM commission_payments;

-- Clear order items (references orders)
DELETE FROM order_items;

-- Clear client orders (references referrals and partners)
DELETE FROM client_orders;

-- Clear orders (main order records)
DELETE FROM orders;

-- Clear referrals (partner referral data)
DELETE FROM referrals;

-- Clear cart items (active shopping carts)
DELETE FROM cart_items;

-- Clear purchase-related user interactions (keep likes, shares, views)
-- Note: 'purchase' is not in the schema constraint, but clear if any exist
DELETE FROM user_interactions 
WHERE interaction_type NOT IN ('like', 'share', 'unlike', 'view');

-- =============================================================================
-- STEP 3: Verify cleanup - show final counts
-- =============================================================================
SELECT 
    'AFTER CLEANUP' as status,
    'orders' as table_name,
    COUNT(*) as count,
    CASE WHEN COUNT(*) = 0 THEN '✅ CLEARED' ELSE '❌ HAS DATA' END as result
FROM orders
UNION ALL
SELECT 
    'AFTER CLEANUP' as status,
    'order_items' as table_name,
    COUNT(*) as count,
    CASE WHEN COUNT(*) = 0 THEN '✅ CLEARED' ELSE '❌ HAS DATA' END as result
FROM order_items
UNION ALL
SELECT 
    'AFTER CLEANUP' as status,
    'referrals' as table_name,
    COUNT(*) as count,
    CASE WHEN COUNT(*) = 0 THEN '✅ CLEARED' ELSE '❌ HAS DATA' END as result
FROM referrals
UNION ALL
SELECT 
    'AFTER CLEANUP' as status,
    'client_orders' as table_name,
    COUNT(*) as count,
    CASE WHEN COUNT(*) = 0 THEN '✅ CLEARED' ELSE '❌ HAS DATA' END as result
FROM client_orders
UNION ALL
SELECT 
    'AFTER CLEANUP' as status,
    'referral_analytics' as table_name,
    COUNT(*) as count,
    CASE WHEN COUNT(*) = 0 THEN '✅ CLEARED' ELSE '❌ HAS DATA' END as result
FROM referral_analytics
UNION ALL
SELECT 
    'AFTER CLEANUP' as status,
    'commission_payments' as table_name,
    COUNT(*) as count,
    CASE WHEN COUNT(*) = 0 THEN '✅ CLEARED' ELSE '❌ HAS DATA' END as result
FROM commission_payments
UNION ALL
SELECT 
    'AFTER CLEANUP' as status,
    'cart_items' as table_name,
    COUNT(*) as count,
    CASE WHEN COUNT(*) = 0 THEN '✅ CLEARED' ELSE '❌ HAS DATA' END as result
FROM cart_items
ORDER BY table_name;

-- =============================================================================
-- STEP 4: Show preserved system data
-- =============================================================================
SELECT 
    'PRESERVED' as category,
    'image_catalog' as table_name,
    COUNT(*) as count,
    'AI images preserved' as description
FROM image_catalog
UNION ALL
SELECT 
    'PRESERVED' as category,
    'products' as table_name,
    COUNT(*) as count,
    'Product catalog preserved' as description  
FROM products
UNION ALL
SELECT 
    'PRESERVED' as category,
    'user_profiles' as table_name,
    COUNT(*) as count,
    'User accounts preserved' as description
FROM user_profiles
UNION ALL
SELECT 
    'PRESERVED' as category,
    'partners' as table_name,
    COUNT(*) as count,
    'Partner profiles preserved' as description
FROM partners
UNION ALL
SELECT 
    'PRESERVED' as category,
    'customers' as table_name,
    COUNT(*) as count,
    'Customer profiles preserved' as description
FROM customers
UNION ALL
SELECT 
    'PRESERVED' as category,
    'user_interactions' as table_name,
    COUNT(*) as count,
    'Likes/shares/views preserved' as description
FROM user_interactions
WHERE interaction_type IN ('like', 'share', 'unlike', 'view')
ORDER BY table_name;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 TEST DATA CLEANUP COMPLETED!';
    RAISE NOTICE '✅ All test orders, referrals, and commissions cleared';
    RAISE NOTICE '🔒 User profiles, products, and AI catalog preserved';  
    RAISE NOTICE '💖 User engagement data (likes/shares) preserved';
    RAISE NOTICE '🚀 Ready for production orders!';
    RAISE NOTICE '';
END $$;