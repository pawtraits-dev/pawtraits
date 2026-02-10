-- Phase 1 Migration: Extend orders table for multi-fulfillment support
-- Purpose: Add fulfillment type tracking and digital delivery status

-- Add fulfillment_type column (physical, digital, hybrid)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS fulfillment_type TEXT
  CHECK (fulfillment_type IN ('physical', 'digital', 'hybrid'))
  DEFAULT 'physical';

-- Add fulfillment_status column (overall fulfillment status)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS fulfillment_status TEXT
  CHECK (fulfillment_status IN ('pending', 'processing', 'fulfilled', 'failed', 'partially_fulfilled'))
  DEFAULT 'pending';

-- Add digital_delivery_status column (specific to digital orders)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS digital_delivery_status TEXT
  CHECK (digital_delivery_status IN ('pending', 'sent', 'downloaded', 'expired'));

-- Add download_expires_at timestamp
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS download_expires_at TIMESTAMP WITH TIME ZONE;

-- Add indexes for filtering and performance
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_type ON orders(fulfillment_type);
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status ON orders(fulfillment_status);
CREATE INDEX IF NOT EXISTS idx_orders_digital_delivery_status ON orders(digital_delivery_status)
  WHERE digital_delivery_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_download_expires_at ON orders(download_expires_at)
  WHERE download_expires_at IS NOT NULL;

-- Add helpful comments
COMMENT ON COLUMN orders.fulfillment_type IS 'Type of order fulfillment: physical (shipped goods), digital (downloads), hybrid (both)';
COMMENT ON COLUMN orders.fulfillment_status IS 'Overall fulfillment status across all items in the order';
COMMENT ON COLUMN orders.digital_delivery_status IS 'Status of digital delivery: pending, sent (email sent), downloaded (customer accessed), expired';
COMMENT ON COLUMN orders.download_expires_at IS 'When download links expire for digital orders (typically 7-30 days after purchase)';

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Phase 1 Migration 02: Orders table extended successfully';
  RAISE NOTICE 'Added columns: fulfillment_type, fulfillment_status, digital_delivery_status, download_expires_at';
  RAISE NOTICE 'Created indexes for fulfillment tracking';
END $$;
