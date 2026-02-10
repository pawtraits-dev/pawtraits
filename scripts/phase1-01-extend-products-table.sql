-- Phase 1 Migration: Extend products table for multi-fulfillment support
-- Purpose: Add product type, fulfillment method, and digital product metadata

-- Add product_type column (physical_print, digital_download, hybrid)
ALTER TABLE products
ADD COLUMN IF NOT EXISTS product_type TEXT
  CHECK (product_type IN ('physical_print', 'digital_download', 'hybrid'))
  DEFAULT 'physical_print';

-- Add fulfillment_method column (gelato, manual, prodigi, download, hybrid)
ALTER TABLE products
ADD COLUMN IF NOT EXISTS fulfillment_method TEXT
  CHECK (fulfillment_method IN ('gelato', 'manual', 'prodigi', 'download', 'hybrid'))
  DEFAULT 'gelato';

-- Add requires_shipping flag
ALTER TABLE products
ADD COLUMN IF NOT EXISTS requires_shipping BOOLEAN DEFAULT true;

-- Digital product specific fields
ALTER TABLE products
ADD COLUMN IF NOT EXISTS digital_file_type TEXT
  CHECK (digital_file_type IN ('jpg', 'png', 'pdf', 'all'));

ALTER TABLE products
ADD COLUMN IF NOT EXISTS digital_resolution TEXT;  -- e.g., "4K", "300dpi", "web-optimized"

ALTER TABLE products
ADD COLUMN IF NOT EXISTS license_type TEXT
  CHECK (license_type IN ('personal', 'commercial', 'extended'));

-- Add indexes for filtering and performance
CREATE INDEX IF NOT EXISTS idx_products_product_type ON products(product_type);
CREATE INDEX IF NOT EXISTS idx_products_fulfillment_method ON products(fulfillment_method);
CREATE INDEX IF NOT EXISTS idx_products_requires_shipping ON products(requires_shipping);

-- Add helpful comment
COMMENT ON COLUMN products.product_type IS 'Type of product: physical_print (printed goods), digital_download (instant delivery files), hybrid (both physical and digital)';
COMMENT ON COLUMN products.fulfillment_method IS 'How the product is fulfilled: gelato (Gelato API), manual (manual POD), prodigi (Prodigi API), download (digital download), hybrid (mixed)';
COMMENT ON COLUMN products.requires_shipping IS 'Whether the product requires physical shipping (false for digital downloads)';
COMMENT ON COLUMN products.digital_file_type IS 'File format for digital downloads: jpg, png, pdf, or all formats';
COMMENT ON COLUMN products.digital_resolution IS 'Resolution/quality for digital files (e.g., 4K, 300dpi, web-optimized)';
COMMENT ON COLUMN products.license_type IS 'License type for digital downloads: personal, commercial, extended';

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Phase 1 Migration 01: Products table extended successfully';
  RAISE NOTICE 'Added columns: product_type, fulfillment_method, requires_shipping';
  RAISE NOTICE 'Added digital product fields: digital_file_type, digital_resolution, license_type';
  RAISE NOTICE 'Created indexes for product_type and fulfillment_method';
END $$;
