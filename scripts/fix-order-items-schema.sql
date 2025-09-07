-- =====================================================================================
-- FIX ORDER_ITEMS TABLE SCHEMA - Add missing fields needed by Stripe webhook
-- =====================================================================================
-- This adds the missing fields that the Stripe webhook tries to insert but don't exist

-- First, let's see the current schema
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'order_items' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Add missing fields that the Stripe webhook needs
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS product_id TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS unit_price INTEGER, -- in pence/cents
ADD COLUMN IF NOT EXISTS total_price INTEGER; -- in pence/cents

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_unit_price ON public.order_items(unit_price);

-- Add comments
COMMENT ON COLUMN public.order_items.product_id IS 'Product identifier (Gelato SKU or internal product ID)';
COMMENT ON COLUMN public.order_items.image_url IS 'URL of the original image for this order item';
COMMENT ON COLUMN public.order_items.unit_price IS 'Unit price in minor currency units (pence/cents)';
COMMENT ON COLUMN public.order_items.total_price IS 'Total price for this line item in minor currency units';

-- Show the updated schema
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'order_items' 
AND table_schema = 'public'
ORDER BY ordinal_position;