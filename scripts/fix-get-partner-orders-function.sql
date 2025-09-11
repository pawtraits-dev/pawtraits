-- Fix get_partner_orders function - correct column reference error
-- The function was incorrectly referencing p.user_id which doesn't exist

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
      SELECT 1 FROM partners p
      WHERE p.email = p_partner_email
      AND o.placed_by_partner_id = p.id
    )
  ORDER BY o.created_at DESC;
END;
$$;

-- Verify the function was created successfully
SELECT 'get_partner_orders function updated successfully' as result;