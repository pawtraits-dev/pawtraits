-- Check current orders table schema and identify missing columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'orders' 
ORDER BY ordinal_position;

-- Check if payment_intent_id column exists specifically
SELECT EXISTS (
  SELECT FROM information_schema.columns 
  WHERE table_name = 'orders' 
  AND column_name = 'payment_intent_id'
) as payment_intent_id_exists;

-- Check if gelato_order_id column exists
SELECT EXISTS (
  SELECT FROM information_schema.columns 
  WHERE table_name = 'orders' 
  AND column_name = 'gelato_order_id'  
) as gelato_order_id_exists;

-- Show sample orders data structure
SELECT * FROM orders LIMIT 1;