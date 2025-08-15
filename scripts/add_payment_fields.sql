-- Add missing payment and fulfillment fields to orders table
-- This script adds fields needed for Stripe payment integration and Gelato fulfillment

-- Add Stripe payment integration fields
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS payment_intent_id TEXT,
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';

-- Add Gelato fulfillment fields
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS gelato_order_id TEXT,
ADD COLUMN IF NOT EXISTS gelato_status TEXT,
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Update order_items table to support enhanced Gelato data
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS product_data JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS print_image_url TEXT;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_payment_intent ON orders(payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_gelato_order ON orders(gelato_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_gelato_status ON orders(gelato_status);

-- Add check constraint for payment status
ALTER TABLE orders DROP CONSTRAINT IF EXISTS check_payment_status;
ALTER TABLE orders ADD CONSTRAINT check_payment_status 
  CHECK (payment_status IN ('pending', 'paid', 'failed', 'canceled'));

-- Add check constraint for Gelato status  
ALTER TABLE orders DROP CONSTRAINT IF EXISTS check_gelato_status;
ALTER TABLE orders ADD CONSTRAINT check_gelato_status 
  CHECK (gelato_status IS NULL OR gelato_status IN ('pending', 'processing', 'shipped', 'delivered', 'error'));

-- Update order items structure to match webhook expectations
ALTER TABLE order_items DROP COLUMN IF EXISTS product_metadata;
ALTER TABLE order_items DROP COLUMN IF EXISTS image_url;
ALTER TABLE order_items DROP COLUMN IF EXISTS unit_price;
ALTER TABLE order_items DROP COLUMN IF EXISTS total_price;

-- Add proper order items columns
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS unit_price INTEGER,
ADD COLUMN IF NOT EXISTS total_price INTEGER;