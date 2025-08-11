-- =============================================================================
-- ORDERS TABLES FOR E-COMMERCE FUNCTIONALITY
-- =============================================================================
-- Add this to your Supabase database to enable the orders functionality

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'confirmed', -- confirmed, processing, shipped, delivered, cancelled
  customer_email TEXT NOT NULL,
  shipping_first_name TEXT NOT NULL,
  shipping_last_name TEXT NOT NULL,
  shipping_address TEXT NOT NULL,
  shipping_city TEXT NOT NULL,
  shipping_postcode TEXT NOT NULL,
  shipping_country TEXT NOT NULL DEFAULT 'United Kingdom',
  subtotal_amount INTEGER NOT NULL, -- in minor units (pence)
  shipping_amount INTEGER NOT NULL DEFAULT 0, -- in minor units (pence)
  total_amount INTEGER NOT NULL, -- in minor units (pence)
  currency TEXT NOT NULL DEFAULT 'GBP',
  estimated_delivery TIMESTAMP WITH TIME ZONE,
  tracking_number TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL, -- Reference to product ID
  image_id TEXT NOT NULL, -- Reference to image ID
  image_url TEXT NOT NULL, -- Store image URL for historical reference
  image_title TEXT NOT NULL, -- Store image title for historical reference
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL, -- in minor units (pence)
  total_price INTEGER NOT NULL, -- in minor units (pence)
  product_metadata JSONB DEFAULT '{}', -- Store product details for historical reference
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_image_id ON order_items(image_id);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for orders table
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add some sample order statuses as check constraints (optional)
-- ALTER TABLE orders ADD CONSTRAINT check_order_status 
--   CHECK (status IN ('confirmed', 'processing', 'shipped', 'delivered', 'cancelled'));

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT ALL ON orders TO authenticated;
-- GRANT ALL ON order_items TO authenticated;
-- GRANT ALL ON orders TO service_role;
-- GRANT ALL ON order_items TO service_role;

-- Add RLS (Row Level Security) policies if needed
-- ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Example RLS policy (customers can only see their own orders)
-- CREATE POLICY "Users can view their own orders" ON orders
--   FOR SELECT USING (auth.email() = customer_email);

-- Example RLS policy (service role can access all orders)
-- CREATE POLICY "Service role can access all orders" ON orders
--   FOR ALL USING (auth.role() = 'service_role');