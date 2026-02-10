-- Phase 1 Migration v2: Extend products table for bundled digital downloads
-- Purpose: Add digital download flag to physical products (not separate product types)

-- Add includes_digital_download flag (all physical products include digital downloads)
ALTER TABLE products
ADD COLUMN IF NOT EXISTS includes_digital_download BOOLEAN DEFAULT true;

-- Add fulfillment_method column for future manual/other providers
ALTER TABLE products
ADD COLUMN IF NOT EXISTS fulfillment_method TEXT
  CHECK (fulfillment_method IN ('gelato', 'manual', 'prodigi'))
  DEFAULT 'gelato';

-- Digital download configuration (applies to all products with includes_digital_download = true)
ALTER TABLE products
ADD COLUMN IF NOT EXISTS digital_file_formats TEXT[]
  DEFAULT ARRAY['jpg', 'png', 'pdf']; -- Array of formats customer can choose

ALTER TABLE products
ADD COLUMN IF NOT EXISTS digital_resolution TEXT DEFAULT 'high'; -- high, medium, web

ALTER TABLE products
ADD COLUMN IF NOT EXISTS digital_download_expiry_days INTEGER DEFAULT 30; -- How many days until download expires

-- Add indexes for filtering and performance
CREATE INDEX IF NOT EXISTS idx_products_includes_digital ON products(includes_digital_download);
CREATE INDEX IF NOT EXISTS idx_products_fulfillment_method ON products(fulfillment_method);

-- Add helpful comments
COMMENT ON COLUMN products.includes_digital_download IS 'Whether this physical product includes a free digital download (default: true)';
COMMENT ON COLUMN products.fulfillment_method IS 'How the physical product is fulfilled: gelato (Gelato API), manual (manual POD), prodigi (Prodigi API)';
COMMENT ON COLUMN products.digital_file_formats IS 'Array of file formats available for digital download (jpg, png, pdf)';
COMMENT ON COLUMN products.digital_resolution IS 'Resolution/quality for digital files: high (print quality), medium (screen quality), web (optimized)';
COMMENT ON COLUMN products.digital_download_expiry_days IS 'Number of days until digital download links expire (default: 30 days)';

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Phase 1 Migration 01 v2: Products table extended successfully';
  RAISE NOTICE 'Added: includes_digital_download (default true - all physical products include digital)';
  RAISE NOTICE 'Added: fulfillment_method for future multi-provider support';
  RAISE NOTICE 'Added: digital_file_formats, digital_resolution, digital_download_expiry_days';
  RAISE NOTICE 'Note: No separate "digital_download" product type - digital is bundled with physical';
END $$;
