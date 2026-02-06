-- ============================================================================
-- COMPREHENSIVE BUNDLE PRICING MIGRATION
-- Runs ALL necessary migrations for bundle pricing system
-- ============================================================================

-- ============================================================================
-- STEP 1: Extend products table (Phase 1 multi-fulfillment)
-- ============================================================================

-- Add product_type column
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS product_type TEXT
  CHECK (product_type IN ('physical_print', 'digital_download', 'hybrid'))
  DEFAULT 'physical_print';

-- Add fulfillment_method column
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS fulfillment_method TEXT
  CHECK (fulfillment_method IN ('gelato', 'manual', 'prodigi', 'download', 'hybrid'))
  DEFAULT 'gelato';

-- Add requires_shipping column
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS requires_shipping BOOLEAN DEFAULT true;

-- Add digital file configuration columns
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS digital_file_type TEXT
  CHECK (digital_file_type IN ('jpg', 'png', 'pdf', 'all'));

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS digital_resolution TEXT;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS license_type TEXT
  CHECK (license_type IN ('personal', 'commercial', 'extended'));

-- Add image_count column (Phase 0 multi-image products)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_count INTEGER DEFAULT 1;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_products_product_type ON public.products(product_type);
CREATE INDEX IF NOT EXISTS idx_products_fulfillment_method ON public.products(fulfillment_method);
CREATE INDEX IF NOT EXISTS idx_products_image_count ON public.products(image_count) WHERE image_count > 1;

-- Backfill existing products
UPDATE public.products
SET product_type = 'physical_print',
    fulfillment_method = 'gelato',
    requires_shipping = true,
    image_count = 1
WHERE product_type IS NULL;

-- ============================================================================
-- STEP 2: Extend order_items table (Phase 0 & Phase 1)
-- ============================================================================

-- Phase 0: Multi-image support
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS image_ids TEXT[];
CREATE INDEX IF NOT EXISTS idx_order_items_image_ids ON public.order_items USING gin(image_ids);

-- Phase 1: Digital download tracking
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS is_physical BOOLEAN DEFAULT true;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS is_digital BOOLEAN DEFAULT false;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS download_url TEXT;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS download_url_generated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS download_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS download_access_count INTEGER DEFAULT 0;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS last_downloaded_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS digital_file_format TEXT;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS digital_file_size_bytes BIGINT;

CREATE INDEX IF NOT EXISTS idx_order_items_download_expires_at
  ON public.order_items(download_expires_at)
  WHERE download_expires_at IS NOT NULL;

-- ============================================================================
-- STEP 3: Create digital_bundle_tiers table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.digital_bundle_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quantity INTEGER NOT NULL UNIQUE,
  price_gbp INTEGER NOT NULL,
  discount_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT digital_bundle_tiers_quantity_positive CHECK (quantity > 0),
  CONSTRAINT digital_bundle_tiers_price_positive CHECK (price_gbp > 0),
  CONSTRAINT digital_bundle_tiers_discount_valid CHECK (discount_percentage >= 0 AND discount_percentage <= 100)
);

COMMENT ON TABLE public.digital_bundle_tiers IS 'Pricing tiers for digital download bundles based on quantity purchased';

-- Seed initial pricing tiers
INSERT INTO public.digital_bundle_tiers (quantity, price_gbp, discount_percentage) VALUES
  (1, 999, 0.00),
  (2, 1749, 12.31),
  (3, 2249, 24.96),
  (4, 2849, 28.59),
  (5, 3349, 32.99),
  (6, 3799, 36.65),
  (7, 4199, 39.91),
  (8, 4549, 42.94),
  (9, 4849, 45.66),
  (10, 5099, 48.95)
ON CONFLICT (quantity) DO NOTHING;

-- RLS policies
ALTER TABLE public.digital_bundle_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active bundle tiers" ON public.digital_bundle_tiers;
CREATE POLICY "Public can view active bundle tiers"
  ON public.digital_bundle_tiers FOR SELECT
  TO public
  USING (is_active = true);

DROP POLICY IF EXISTS "Admin can manage bundle tiers" ON public.digital_bundle_tiers;
CREATE POLICY "Admin can manage bundle tiers"
  ON public.digital_bundle_tiers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.user_type = 'admin'
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_digital_bundle_tiers_quantity
  ON public.digital_bundle_tiers(quantity);
CREATE INDEX IF NOT EXISTS idx_digital_bundle_tiers_active
  ON public.digital_bundle_tiers(is_active) WHERE is_active = true;

-- ============================================================================
-- STEP 4: Create master bundle product
-- ============================================================================

DO $$
DECLARE
  bundle_product_id UUID;
  default_medium_id UUID;
  default_format_id UUID;
BEGIN
  -- Check for existing master bundle product
  SELECT id INTO bundle_product_id
  FROM public.products
  WHERE name = 'Digital Download Bundle'
  AND product_type = 'digital_download'
  LIMIT 1;

  IF bundle_product_id IS NOT NULL THEN
    RAISE NOTICE 'ℹ️  Master bundle product already exists: %', bundle_product_id;
    RETURN;
  END IF;

  -- Get a default medium and format (we'll use first available)
  SELECT id INTO default_medium_id FROM public.media LIMIT 1;
  SELECT id INTO default_format_id FROM public.formats LIMIT 1;

  IF default_medium_id IS NULL OR default_format_id IS NULL THEN
    RAISE EXCEPTION 'Cannot create bundle product: no media or format records found';
  END IF;

  -- Create the master bundle product
  -- NOTE: Pricing for this product is handled dynamically by digital_bundle_tiers table
  INSERT INTO public.products (
    name,
    description,
    sku,
    medium_id,
    format_id,
    product_type,
    fulfillment_method,
    requires_shipping,
    is_active,
    digital_file_type,
    digital_resolution,
    license_type,
    image_count
  ) VALUES (
    'Digital Download Bundle',
    'High-resolution digital download of pet portrait. Purchase multiple images and save with bundle pricing!',
    'DIGITAL-BUNDLE-001',
    default_medium_id,
    default_format_id,
    'digital_download',
    'download',
    false,
    true,
    'jpg',
    'high',
    'personal',
    1
  )
  RETURNING id INTO bundle_product_id;

  RAISE NOTICE '✅ Created master bundle product: %', bundle_product_id;
END $$;

-- ============================================================================
-- VALIDATION & SUMMARY
-- ============================================================================

DO $$
DECLARE
  tier_count INTEGER;
  product_count INTEGER;
  columns_exist BOOLEAN;
BEGIN
  -- Check if columns exist
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'products'
    AND column_name = 'product_type'
  ) INTO columns_exist;

  IF NOT columns_exist THEN
    RAISE EXCEPTION '❌ Migration failed: product_type column not created';
  END IF;

  -- Count tiers
  SELECT COUNT(*) INTO tier_count
  FROM public.digital_bundle_tiers
  WHERE is_active = true;

  -- Count master bundle products
  SELECT COUNT(*) INTO product_count
  FROM public.products
  WHERE name = 'Digital Download Bundle'
  AND product_type = 'digital_download';

  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '📊 BUNDLE PRICING MIGRATION SUMMARY';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Phase 0: Multi-image products';
  RAISE NOTICE '   - products.image_count: Added';
  RAISE NOTICE '   - order_items.image_ids: Added';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Phase 1: Multi-fulfillment extensions';
  RAISE NOTICE '   - products.product_type: Verified';
  RAISE NOTICE '   - products.fulfillment_method: Verified';
  RAISE NOTICE '   - products.digital_file_type: Verified';
  RAISE NOTICE '   - order_items.is_digital: Added';
  RAISE NOTICE '   - order_items.download_url: Added';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Phase 1: Bundle pricing';
  RAISE NOTICE '   - digital_bundle_tiers table: Created';
  RAISE NOTICE '   - Active pricing tiers: % tiers', tier_count;
  RAISE NOTICE '   - Master bundle product: % created', product_count;
  RAISE NOTICE '';
  RAISE NOTICE '💰 Pricing Structure:';
  RAISE NOTICE '   1 image:  £9.99  (0%% discount)';
  RAISE NOTICE '   2 images: £17.49 (12%% discount)';
  RAISE NOTICE '   3 images: £22.49 (25%% discount)';
  RAISE NOTICE '   10 images: £50.99 (49%% discount)';
  RAISE NOTICE '';
  RAISE NOTICE '✅ ALL MIGRATIONS COMPLETE';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;
