-- =====================================================================================
-- VERIFICATION SCRIPT - Confirm test data cleanup was successful
-- =====================================================================================

-- Check that all transactional data is cleared
SELECT 
    'CLEARED TABLES' as section,
    table_name,
    row_count,
    CASE 
        WHEN row_count = 0 THEN '✅ CLEAN'
        ELSE '❌ HAS DATA'
    END as status
FROM (
    SELECT 'orders' as table_name, COUNT(*) as row_count FROM orders
    UNION ALL
    SELECT 'order_items' as table_name, COUNT(*) as row_count FROM order_items  
    UNION ALL
    SELECT 'client_orders' as table_name, COUNT(*) as row_count FROM client_orders
    UNION ALL
    SELECT 'referrals' as table_name, COUNT(*) as row_count FROM referrals
    UNION ALL
    SELECT 'referral_analytics' as table_name, COUNT(*) as row_count FROM referral_analytics
) t
UNION ALL
-- Show preserved system data
SELECT 
    'PRESERVED SYSTEM DATA' as section,
    table_name,
    row_count,
    '📋 PRESERVED' as status
FROM (
    SELECT 'user_profiles' as table_name, COUNT(*) as row_count FROM user_profiles
    UNION ALL
    SELECT 'partners' as table_name, COUNT(*) as row_count FROM partners
    UNION ALL
    SELECT 'customers' as table_name, COUNT(*) as row_count FROM customers
    UNION ALL
    SELECT 'image_catalog' as table_name, COUNT(*) as row_count FROM image_catalog
    UNION ALL
    SELECT 'products' as table_name, COUNT(*) as row_count FROM products
    UNION ALL
    SELECT 'breeds' as table_name, COUNT(*) as row_count FROM breeds
    UNION ALL
    SELECT 'themes' as table_name, COUNT(*) as row_count FROM themes
    UNION ALL
    SELECT 'styles' as table_name, COUNT(*) as row_count FROM styles
) t
ORDER BY section, table_name;

-- Summary message
SELECT 
    CASE 
        WHEN (SELECT COUNT(*) FROM orders) = 0 
        AND (SELECT COUNT(*) FROM order_items) = 0 
        AND (SELECT COUNT(*) FROM client_orders) = 0 
        AND (SELECT COUNT(*) FROM referrals) = 0 
        AND (SELECT COUNT(*) FROM referral_analytics) = 0
        THEN '🎉 SUCCESS: All test data cleared! Ready for production orders.'
        ELSE '⚠️ WARNING: Some test data remains. Check the results above.'
    END as cleanup_result;