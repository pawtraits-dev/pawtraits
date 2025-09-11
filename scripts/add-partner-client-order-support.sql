-- Add partner-client order support to orders table
-- This allows proper attribution when partners place orders for clients

-- Add new columns to orders table
ALTER TABLE orders 
ADD COLUMN placed_by_partner_id UUID REFERENCES partners(id),
ADD COLUMN client_email VARCHAR(255),
ADD COLUMN client_name VARCHAR(255),
ADD COLUMN order_type VARCHAR(50) DEFAULT 'customer' CHECK (order_type IN ('customer', 'partner', 'partner_for_client'));

-- Add comments explaining the new columns
COMMENT ON COLUMN orders.placed_by_partner_id IS 'Partner who placed this order (null for direct customer orders)';
COMMENT ON COLUMN orders.client_email IS 'Client email when partner places order for client';
COMMENT ON COLUMN orders.client_name IS 'Client name when partner places order for client';
COMMENT ON COLUMN orders.order_type IS 'Type of order: customer (direct), partner (partner for self), partner_for_client (partner for client)';

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_orders_placed_by_partner_id ON orders(placed_by_partner_id);
CREATE INDEX IF NOT EXISTS idx_orders_client_email ON orders(client_email);
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON orders(order_type);

-- Update existing orders to have proper order_type based on existing data
-- This will help identify which orders were partner orders
UPDATE orders 
SET order_type = CASE 
  WHEN EXISTS (
    SELECT 1 FROM user_profiles up 
    WHERE up.email = orders.customer_email 
    AND up.user_type = 'partner'
  ) THEN 'partner'
  ELSE 'customer'
END
WHERE order_type = 'customer';

-- Create a function to get orders for a client (including orders placed by partners for them)
CREATE OR REPLACE FUNCTION get_client_orders(p_client_email TEXT)
RETURNS TABLE (
  id UUID,
  order_number VARCHAR(100),
  status VARCHAR(50),
  customer_email VARCHAR(255),
  client_email VARCHAR(255),
  client_name VARCHAR(255),
  placed_by_partner_id UUID,
  order_type VARCHAR(50),
  total_amount INTEGER,
  currency VARCHAR(10),
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  estimated_delivery TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.order_number,
    o.status,
    o.customer_email,
    o.client_email,
    o.client_name,
    o.placed_by_partner_id,
    o.order_type,
    o.total_amount,
    o.currency,
    o.created_at,
    o.updated_at,
    o.estimated_delivery
  FROM orders o
  WHERE 
    -- Direct customer orders
    (o.customer_email = p_client_email AND o.order_type = 'customer')
    OR 
    -- Orders placed by partners for this client
    (o.client_email = p_client_email AND o.order_type = 'partner_for_client')
  ORDER BY o.created_at DESC;
END;
$$;

-- Create a function to get partner orders (including orders they placed for clients)
CREATE OR REPLACE FUNCTION get_partner_orders(p_partner_email TEXT)
RETURNS TABLE (
  id UUID,
  order_number VARCHAR(100),
  status VARCHAR(50),
  customer_email VARCHAR(255),
  client_email VARCHAR(255),
  client_name VARCHAR(255),
  placed_by_partner_id UUID,
  order_type VARCHAR(50),
  total_amount INTEGER,
  currency VARCHAR(10),
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  estimated_delivery TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.order_number,
    o.status,
    o.customer_email,
    o.client_email,
    o.client_name,
    o.placed_by_partner_id,
    o.order_type,
    o.total_amount,
    o.currency,
    o.created_at,
    o.updated_at,
    o.estimated_delivery
  FROM orders o
  WHERE 
    -- Orders placed by this partner (for themselves or clients)
    o.customer_email = p_partner_email
    OR 
    EXISTS (
      SELECT 1 FROM partners p, user_profiles up
      WHERE p.user_id = up.id 
      AND up.email = p_partner_email
      AND o.placed_by_partner_id = p.id
    )
  ORDER BY o.created_at DESC;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_client_orders(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_partner_orders(TEXT) TO authenticated;

-- Verify the schema changes
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name IN ('placed_by_partner_id', 'client_email', 'client_name', 'order_type')
ORDER BY column_name;