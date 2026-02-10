-- Phase 1 Migration: Create order_fulfillment_tracking table
-- Purpose: Track fulfillment progress across different providers and methods

-- Drop existing table if it exists (for clean migration)
DROP TABLE IF EXISTS public.order_fulfillment_tracking CASCADE;

-- Create order_fulfillment_tracking table
CREATE TABLE public.order_fulfillment_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  order_item_id UUID,

  fulfillment_method TEXT NOT NULL,  -- 'gelato', 'manual', 'download', 'prodigi', etc.
  status TEXT NOT NULL CHECK (status IN (
    'pending',
    'processing',
    'fulfilled',
    'failed',
    'cancelled'
  )),
  status_message TEXT,

  tracking_data JSONB,  -- Provider-specific tracking info (tracking numbers, URLs, etc.)

  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT order_fulfillment_tracking_pkey PRIMARY KEY (id),
  CONSTRAINT order_fulfillment_tracking_order_id_fkey
    FOREIGN KEY (order_id)
    REFERENCES public.orders(id)
    ON DELETE CASCADE,
  CONSTRAINT order_fulfillment_tracking_order_item_id_fkey
    FOREIGN KEY (order_item_id)
    REFERENCES public.order_items(id)
    ON DELETE CASCADE
);

-- Add indexes for efficient querying
CREATE INDEX idx_fulfillment_tracking_order_id ON public.order_fulfillment_tracking(order_id);
CREATE INDEX idx_fulfillment_tracking_order_item_id ON public.order_fulfillment_tracking(order_item_id)
  WHERE order_item_id IS NOT NULL;
CREATE INDEX idx_fulfillment_tracking_status ON public.order_fulfillment_tracking(status);
CREATE INDEX idx_fulfillment_tracking_fulfillment_method ON public.order_fulfillment_tracking(fulfillment_method);
CREATE INDEX idx_fulfillment_tracking_created_at ON public.order_fulfillment_tracking(created_at DESC);

-- Add helpful comments
COMMENT ON TABLE public.order_fulfillment_tracking IS 'Tracks fulfillment progress for orders across different providers (Gelato, Prodigi, manual, digital downloads)';
COMMENT ON COLUMN public.order_fulfillment_tracking.order_id IS 'Reference to the order being fulfilled';
COMMENT ON COLUMN public.order_fulfillment_tracking.order_item_id IS 'Optional reference to specific order item (null for order-level tracking)';
COMMENT ON COLUMN public.order_fulfillment_tracking.fulfillment_method IS 'The fulfillment provider or method: gelato, prodigi, manual, download';
COMMENT ON COLUMN public.order_fulfillment_tracking.status IS 'Current status: pending, processing, fulfilled, failed, cancelled';
COMMENT ON COLUMN public.order_fulfillment_tracking.status_message IS 'Human-readable status message or error description';
COMMENT ON COLUMN public.order_fulfillment_tracking.tracking_data IS 'JSONB containing provider-specific tracking information (tracking numbers, shipment IDs, URLs)';
COMMENT ON COLUMN public.order_fulfillment_tracking.started_at IS 'When fulfillment processing began';
COMMENT ON COLUMN public.order_fulfillment_tracking.completed_at IS 'When fulfillment was successfully completed';
COMMENT ON COLUMN public.order_fulfillment_tracking.failed_at IS 'When fulfillment failed (if applicable)';

-- Enable Row Level Security
ALTER TABLE public.order_fulfillment_tracking ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Admin users can see all fulfillment tracking
CREATE POLICY "Admin users can view all fulfillment tracking"
  ON public.order_fulfillment_tracking
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.user_type = 'admin'
    )
  );

-- Customers can see tracking for their own orders
CREATE POLICY "Customers can view their own order fulfillment tracking"
  ON public.order_fulfillment_tracking
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      JOIN public.user_profiles ON orders.customer_email = user_profiles.email
      WHERE orders.id = order_fulfillment_tracking.order_id
      AND user_profiles.id = auth.uid()
    )
  );

-- Admin users can insert/update fulfillment tracking
CREATE POLICY "Admin users can manage fulfillment tracking"
  ON public.order_fulfillment_tracking
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.user_type = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.user_type = 'admin'
    )
  );

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Phase 1 Migration 04: Order fulfillment tracking table created successfully';
  RAISE NOTICE 'Table: order_fulfillment_tracking';
  RAISE NOTICE 'Supports tracking for: gelato, prodigi, manual, download fulfillment methods';
  RAISE NOTICE 'RLS policies created for admin and customer access';
  RAISE NOTICE 'Indexes created for order_id, order_item_id, status, fulfillment_method';
END $$;
