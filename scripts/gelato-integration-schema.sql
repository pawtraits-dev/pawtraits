-- =============================================
-- Gelato Integration Database Schema Updates
-- =============================================

-- 1. Add Gelato-specific columns to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS gelato_order_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS gelato_status TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_url TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS failure_reason TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Add index for Gelato order ID lookups
CREATE INDEX IF NOT EXISTS idx_orders_gelato_order_id ON public.orders(gelato_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_gelato_status ON public.orders(gelato_status);
CREATE INDEX IF NOT EXISTS idx_orders_status_updated ON public.orders(status, updated_at);

-- 2. Create order_items table for detailed line items
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  image_id TEXT NOT NULL,
  image_title TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  product_data JSONB, -- Store product details (medium, format, size, etc.)
  print_image_url TEXT, -- High-resolution image URL for printing
  gelato_line_item_id TEXT, -- Gelato's line item ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT order_items_pkey PRIMARY KEY (id)
);

-- Add indexes for order items
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_image_id ON public.order_items(image_id);

-- 3. Create gelato_webhooks table for audit trail
CREATE TABLE IF NOT EXISTS public.gelato_webhooks (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  gelato_order_id TEXT,
  external_id TEXT, -- Our order number
  payload JSONB NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  processing_status TEXT DEFAULT 'processed', -- processed, failed, skipped
  error_message TEXT,
  
  CONSTRAINT gelato_webhooks_pkey PRIMARY KEY (id)
);

-- Add indexes for webhook tracking
CREATE INDEX IF NOT EXISTS idx_gelato_webhooks_event_type ON public.gelato_webhooks(event_type);
CREATE INDEX IF NOT EXISTS idx_gelato_webhooks_order_id ON public.gelato_webhooks(gelato_order_id);
CREATE INDEX IF NOT EXISTS idx_gelato_webhooks_external_id ON public.gelato_webhooks(external_id);
CREATE INDEX IF NOT EXISTS idx_gelato_webhooks_processed_at ON public.gelato_webhooks(processed_at);

-- 4. Update order status enum to include print fulfillment statuses
-- Note: This would need to be done carefully in production to avoid breaking existing data
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
CHECK (status IN (
  'pending', 'confirmed', 'processing', 'printing', 'shipped', 'delivered', 
  'cancelled', 'failed', 'refunded', 'fulfillment_error'
));

-- 5. Create function to get order with items
CREATE OR REPLACE FUNCTION get_order_with_items(order_id_param UUID)
RETURNS TABLE (
  -- Order fields
  order_id UUID,
  order_number TEXT,
  status TEXT,
  customer_email TEXT,
  total_amount INTEGER,
  currency TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  
  -- Gelato fields
  gelato_order_id TEXT,
  gelato_status TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  shipped_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  
  -- Items (as JSON array)
  items JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id as order_id,
    o.order_number,
    o.status,
    o.customer_email,
    o.total_amount,
    o.currency,
    o.created_at,
    o.gelato_order_id,
    o.gelato_status,
    o.tracking_number,
    o.tracking_url,
    o.shipped_at,
    o.delivered_at,
    COALESCE(
      JSON_AGG(
        JSON_BUILD_OBJECT(
          'id', oi.id,
          'image_id', oi.image_id,
          'image_title', oi.image_title,
          'quantity', oi.quantity,
          'product_data', oi.product_data,
          'print_image_url', oi.print_image_url,
          'gelato_line_item_id', oi.gelato_line_item_id
        ) ORDER BY oi.created_at
      ) FILTER (WHERE oi.id IS NOT NULL),
      '[]'::jsonb
    ) as items
  FROM public.orders o
  LEFT JOIN public.order_items oi ON o.id = oi.order_id
  WHERE o.id = order_id_param
  GROUP BY o.id, o.order_number, o.status, o.customer_email, o.total_amount, 
           o.currency, o.created_at, o.gelato_order_id, o.gelato_status, 
           o.tracking_number, o.tracking_url, o.shipped_at, o.delivered_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create function to update order status with history
CREATE OR REPLACE FUNCTION update_order_status(
  order_id_param UUID,
  new_status TEXT,
  gelato_status_param TEXT DEFAULT NULL,
  tracking_number_param TEXT DEFAULT NULL,
  tracking_url_param TEXT DEFAULT NULL,
  notes TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  updated_rows INTEGER;
BEGIN
  UPDATE public.orders 
  SET 
    status = new_status,
    gelato_status = COALESCE(gelato_status_param, gelato_status),
    tracking_number = COALESCE(tracking_number_param, tracking_number),
    tracking_url = COALESCE(tracking_url_param, tracking_url),
    shipped_at = CASE WHEN new_status = 'shipped' AND shipped_at IS NULL THEN now() ELSE shipped_at END,
    delivered_at = CASE WHEN new_status = 'delivered' AND delivered_at IS NULL THEN now() ELSE delivered_at END,
    cancelled_at = CASE WHEN new_status = 'cancelled' AND cancelled_at IS NULL THEN now() ELSE cancelled_at END,
    updated_at = now()
  WHERE id = order_id_param;
  
  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  
  RETURN updated_rows > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Row Level Security policies for new tables
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gelato_webhooks ENABLE ROW LEVEL SECURITY;

-- Order items can be read by order owner or admins
CREATE POLICY order_items_read_policy ON public.order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o 
      WHERE o.id = order_items.order_id 
      AND (
        o.customer_email = (SELECT auth.jwt() ->> 'email') 
        OR EXISTS (
          SELECT 1 FROM public.user_profiles up 
          WHERE up.email = (SELECT auth.jwt() ->> 'email') 
          AND up.user_type = 'admin'
        )
      )
    )
  );

-- Only admins can read webhook audit logs
CREATE POLICY gelato_webhooks_admin_only ON public.gelato_webhooks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up 
      WHERE up.email = (SELECT auth.jwt() ->> 'email') 
      AND up.user_type = 'admin'
    )
  );

-- Grant permissions
GRANT SELECT ON public.order_items TO anon, authenticated;
GRANT SELECT ON public.gelato_webhooks TO authenticated;
GRANT EXECUTE ON FUNCTION get_order_with_items TO authenticated;
GRANT EXECUTE ON FUNCTION update_order_status TO authenticated;

COMMENT ON TABLE public.order_items IS 'Detailed line items for orders, including print specifications';
COMMENT ON TABLE public.gelato_webhooks IS 'Audit trail of Gelato webhook events';
COMMENT ON FUNCTION get_order_with_items IS 'Get complete order details including line items';
COMMENT ON FUNCTION update_order_status IS 'Update order status with automatic timestamp handling';