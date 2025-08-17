-- Add tracking fields to orders table for Gelato webhook integration
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_code TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_url TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS carrier_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- Create index on gelato_order_id for faster webhook lookups
CREATE INDEX IF NOT EXISTS idx_orders_gelato_order_id ON public.orders(gelato_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_intent_id ON public.orders(payment_intent_id);

-- Update the orders table to ensure we have all necessary fields
COMMENT ON COLUMN public.orders.tracking_code IS 'Tracking number from shipping provider';
COMMENT ON COLUMN public.orders.tracking_url IS 'URL to track package delivery';
COMMENT ON COLUMN public.orders.carrier_name IS 'Name of shipping carrier (DHL, UPS, etc.)';
COMMENT ON COLUMN public.orders.shipped_at IS 'Timestamp when order was shipped';
COMMENT ON COLUMN public.orders.delivered_at IS 'Timestamp when order was delivered';
COMMENT ON COLUMN public.orders.cancelled_at IS 'Timestamp when order was cancelled';
COMMENT ON COLUMN public.orders.cancellation_reason IS 'Reason for order cancellation';
COMMENT ON COLUMN public.orders.failure_reason IS 'Reason for order failure';