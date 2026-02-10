-- Phase 1 Migration: Backfill existing products and orders with default values
-- Purpose: Ensure backward compatibility by setting defaults on existing data

-- Backfill products table
-- All existing products are physical prints fulfilled by Gelato
UPDATE products
SET
  product_type = 'physical_print',
  fulfillment_method = 'gelato',
  requires_shipping = true
WHERE
  product_type IS NULL
  OR fulfillment_method IS NULL
  OR requires_shipping IS NULL;

-- Backfill orders table
-- All existing orders are physical fulfillment
UPDATE orders
SET
  fulfillment_type = 'physical',
  fulfillment_status = CASE
    WHEN gelato_status = 'delivered' THEN 'fulfilled'
    WHEN gelato_status = 'shipped' THEN 'processing'
    WHEN gelato_status = 'failed' THEN 'failed'
    ELSE 'pending'
  END
WHERE
  fulfillment_type IS NULL
  OR fulfillment_status IS NULL;

-- Backfill order_items table
-- All existing order items are physical prints
-- Important: Physical products include bundled digital downloads
UPDATE order_items
SET
  is_physical = true,
  is_digital = true  -- Physical products include digital downloads
WHERE
  is_physical IS NULL
  OR is_digital IS NULL;

-- Log backfill statistics
DO $$
DECLARE
  products_updated INT;
  orders_updated INT;
  order_items_updated INT;
BEGIN
  -- Count updates
  SELECT COUNT(*) INTO products_updated
  FROM products
  WHERE product_type = 'physical_print';

  SELECT COUNT(*) INTO orders_updated
  FROM orders
  WHERE fulfillment_type = 'physical';

  SELECT COUNT(*) INTO order_items_updated
  FROM order_items
  WHERE is_physical = true AND is_digital = false;

  -- Log results
  RAISE NOTICE 'Phase 1 Migration 05: Backfill completed successfully';
  RAISE NOTICE 'Products backfilled: % (set to physical_print, gelato, requires_shipping=true)', products_updated;
  RAISE NOTICE 'Orders backfilled: % (set to fulfillment_type=physical)', orders_updated;
  RAISE NOTICE 'Order items backfilled: % (set to is_physical=true, is_digital=false)', order_items_updated;
  RAISE NOTICE 'All existing data is backward compatible with new schema';
END $$;
