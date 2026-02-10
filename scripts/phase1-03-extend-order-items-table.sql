-- Phase 1 Migration: Extend order_items table for digital download tracking
-- Purpose: Add digital download URLs, tracking, and metadata

-- Add item type flags
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS is_physical BOOLEAN DEFAULT true;

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS is_digital BOOLEAN DEFAULT false;

-- Digital download URL and tracking
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS download_url TEXT;

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS download_url_generated_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS download_expires_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS download_access_count INTEGER DEFAULT 0;

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS last_downloaded_at TIMESTAMP WITH TIME ZONE;

-- Digital file metadata
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS digital_file_format TEXT;  -- jpg, png, pdf

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS digital_file_size_bytes BIGINT;

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS license_terms JSONB;

-- Add indexes for download tracking and expiration cleanup
CREATE INDEX IF NOT EXISTS idx_order_items_is_digital ON order_items(is_digital)
  WHERE is_digital = true;

CREATE INDEX IF NOT EXISTS idx_order_items_download_expires_at ON order_items(download_expires_at)
  WHERE download_expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_download_access_count ON order_items(download_access_count)
  WHERE is_digital = true;

-- Add helpful comments
COMMENT ON COLUMN order_items.is_physical IS 'Whether this item requires physical fulfillment (shipping). True for physical prints.';
COMMENT ON COLUMN order_items.is_digital IS 'Whether this item includes digital download access. True for digital-only products AND physical products (bundled download).';
COMMENT ON COLUMN order_items.download_url IS 'Signed Cloudinary URL for downloading the digital file';
COMMENT ON COLUMN order_items.download_url_generated_at IS 'When the download URL was generated';
COMMENT ON COLUMN order_items.download_expires_at IS 'When the download URL expires (typically 7-30 days)';
COMMENT ON COLUMN order_items.download_access_count IS 'Number of times customer has downloaded this file';
COMMENT ON COLUMN order_items.last_downloaded_at IS 'Most recent download timestamp';
COMMENT ON COLUMN order_items.digital_file_format IS 'File format provided for download (jpg, png, pdf)';
COMMENT ON COLUMN order_items.digital_file_size_bytes IS 'Size of the digital file in bytes';
COMMENT ON COLUMN order_items.license_terms IS 'JSON object containing license terms for this digital download';

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Phase 1 Migration 03: Order items table extended successfully';
  RAISE NOTICE 'Added item type flags: is_physical, is_digital';
  RAISE NOTICE 'Added download tracking: download_url, download_expires_at, download_access_count, last_downloaded_at';
  RAISE NOTICE 'Added digital file metadata: digital_file_format, digital_file_size_bytes, license_terms';
  RAISE NOTICE 'Created indexes for digital items and download expiration tracking';
END $$;
