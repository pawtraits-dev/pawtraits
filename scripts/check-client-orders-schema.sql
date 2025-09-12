-- Check client_orders table structure
SELECT 'client_orders table structure:' as section;

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'client_orders' 
ORDER BY ordinal_position;

SELECT '' as spacer;
SELECT 'client_orders table constraints:' as section;

SELECT 
    constraint_name,
    constraint_type
FROM information_schema.table_constraints 
WHERE table_name = 'client_orders';

SELECT '' as spacer;
SELECT 'Total records in client_orders:' as section;
SELECT COUNT(*) as total_records FROM client_orders;