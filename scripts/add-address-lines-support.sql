-- Add address line 1 and 2 support to orders table
-- This helps handle long addresses that may cause Gelato API failures

-- Add new address line columns
ALTER TABLE orders 
ADD COLUMN shipping_address_line_1 VARCHAR(255),
ADD COLUMN shipping_address_line_2 VARCHAR(255);

-- Add comments explaining the new columns
COMMENT ON COLUMN orders.shipping_address_line_1 IS 'First line of shipping address (street number and name)';
COMMENT ON COLUMN orders.shipping_address_line_2 IS 'Second line of shipping address (apartment, suite, etc.)';

-- Create indexes for address lines (helpful for address searches)
CREATE INDEX IF NOT EXISTS idx_orders_shipping_address_line_1 ON orders(shipping_address_line_1);

-- Migrate existing address data to address_line_1
-- Keep the existing shipping_address field for backward compatibility during transition
UPDATE orders 
SET shipping_address_line_1 = shipping_address
WHERE shipping_address IS NOT NULL 
AND shipping_address_line_1 IS NULL;

-- Add constraint to ensure at least address_line_1 is populated for new orders
ALTER TABLE orders 
ADD CONSTRAINT check_address_line_1_not_empty 
CHECK (shipping_address_line_1 IS NULL OR LENGTH(TRIM(shipping_address_line_1)) > 0);

-- Verify the schema changes
SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name IN ('shipping_address', 'shipping_address_line_1', 'shipping_address_line_2')
ORDER BY column_name;