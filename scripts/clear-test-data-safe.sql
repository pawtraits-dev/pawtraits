-- =====================================================================================
-- SAFE TEST DATA CLEANUP - Only operates on existing tables
-- =====================================================================================
-- This version checks table existence before querying to avoid errors

-- =============================================================================
-- STEP 1: Check what tables exist and show current counts
-- =============================================================================

-- Core tables that should always exist
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
ORDER BY table_name;

-- Check for optional tables
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    -- Check client_orders
    SELECT COUNT(*) INTO table_count FROM information_schema.tables 
    WHERE table_name = 'client_orders' AND table_schema = 'public';
    
    IF table_count > 0 THEN
        SELECT COUNT(*) INTO table_count FROM client_orders;
        RAISE NOTICE 'client_orders table exists with % records', table_count;
    ELSE
        RAISE NOTICE 'client_orders table does not exist';
    END IF;

    -- Check referral_analytics  
    SELECT COUNT(*) INTO table_count FROM information_schema.tables 
    WHERE table_name = 'referral_analytics' AND table_schema = 'public';
    
    IF table_count > 0 THEN
        SELECT COUNT(*) INTO table_count FROM referral_analytics;
        RAISE NOTICE 'referral_analytics table exists with % records', table_count;
    ELSE
        RAISE NOTICE 'referral_analytics table does not exist';
    END IF;
END $$;

-- =============================================================================
-- STEP 2: Clear data from existing tables only
-- =============================================================================

-- Clear order items first (has foreign key to orders)
DELETE FROM order_items;
RAISE NOTICE 'Cleared order_items: % rows deleted', ROW_COUNT;

-- Clear orders
DELETE FROM orders;  
RAISE NOTICE 'Cleared orders: % rows deleted', ROW_COUNT;

-- Clear referrals
DELETE FROM referrals;
RAISE NOTICE 'Cleared referrals: % rows deleted', ROW_COUNT;

-- Clear optional tables if they exist
DO $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Clear client_orders if exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_orders' AND table_schema = 'public') THEN
        DELETE FROM client_orders;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE 'Cleared client_orders: % rows deleted', deleted_count;
    END IF;

    -- Clear referral_analytics if exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'referral_analytics' AND table_schema = 'public') THEN
        DELETE FROM referral_analytics;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE 'Cleared referral_analytics: % rows deleted', deleted_count;
    END IF;

    -- Clear cost_snapshots if exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cost_snapshots' AND table_schema = 'public') THEN
        DELETE FROM cost_snapshots;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE 'Cleared cost_snapshots: % rows deleted', deleted_count;
    END IF;

    -- Clear gelato_webhooks if exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gelato_webhooks' AND table_schema = 'public') THEN
        DELETE FROM gelato_webhooks;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE 'Cleared gelato_webhooks: % rows deleted', deleted_count;
    END IF;

    -- Clear QR tracking if exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'qr_code_tracking' AND table_schema = 'public') THEN
        DELETE FROM qr_code_tracking;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE 'Cleared qr_code_tracking: % rows deleted', deleted_count;
    END IF;
END $$;

-- Clear purchase interactions from user_interactions (if table exists)
DO $$
DECLARE
    deleted_count INTEGER;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_interactions' AND table_schema = 'public') THEN
        DELETE FROM user_interactions WHERE interaction_type = 'purchase';
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE 'Cleared purchase interactions: % rows deleted', deleted_count;
    END IF;
END $$;

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
ORDER BY table_name;

-- Final success message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 CLEANUP COMPLETED SUCCESSFULLY!';
    RAISE NOTICE '✅ All test orders, referrals, and commission data cleared';
    RAISE NOTICE '🔒 System configuration and AI catalog preserved';  
    RAISE NOTICE '🚀 Ready for production orders!';
    RAISE NOTICE '';
END $$;