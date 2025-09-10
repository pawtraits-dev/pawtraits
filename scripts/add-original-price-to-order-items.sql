-- Add original_price column to order_items table for discount calculations
-- This allows us to show original price vs discounted price (especially for partner orders)

ALTER TABLE order_items 
ADD COLUMN original_price INTEGER;

-- Add comment explaining the column
COMMENT ON COLUMN order_items.original_price IS 'Original price before any discounts (in minor units/pence). Used to calculate and display discount amounts.';

-- Create index for potential discount queries
CREATE INDEX IF NOT EXISTS idx_order_items_original_price ON order_items(original_price);

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'order_items' 
AND column_name = 'original_price';