-- Phase 1 Migration: Create Digital Bundle Pricing System
-- Purpose: Enable tiered pricing for digital download bundles

-- ============================================================================
-- DIGITAL_BUNDLE_TIERS TABLE: Pricing tiers based on quantity
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.digital_bundle_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quantity INTEGER NOT NULL UNIQUE,        -- 1, 2, 3, 4, 5, etc.
  price_gbp INTEGER NOT NULL,              -- Price in pence (999, 1749, 2249, etc.)
  discount_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,  -- Discount vs individual
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT digital_bundle_tiers_quantity_positive CHECK (quantity > 0),
  CONSTRAINT digital_bundle_tiers_price_positive CHECK (price_gbp > 0),
  CONSTRAINT digital_bundle_tiers_discount_valid CHECK (discount_percentage >= 0 AND discount_percentage <= 100)
);

COMMENT ON TABLE public.digital_bundle_tiers IS 'Pricing tiers for digital download bundles based on quantity purchased';
COMMENT ON COLUMN public.digital_bundle_tiers.quantity IS 'Number of images in bundle (1, 2, 3, etc.)';
COMMENT ON COLUMN public.digital_bundle_tiers.price_gbp IS 'Total price for this quantity in pence (e.g., 999 = £9.99)';
COMMENT ON COLUMN public.digital_bundle_tiers.discount_percentage IS 'Percentage discount vs buying individually';

-- ============================================================================
-- SEED INITIAL PRICING TIERS
-- ============================================================================

INSERT INTO public.digital_bundle_tiers (quantity, price_gbp, discount_percentage) VALUES
  (1, 999, 0.00),      -- £9.99 (no discount)
  (2, 1749, 12.31),    -- £17.49 (12% off vs £19.98)
  (3, 2249, 24.96),    -- £22.49 (25% off vs £29.97)
  (4, 2849, 28.59),    -- £28.49 (29% off vs £39.96)
  (5, 3349, 32.99),    -- £33.49 (33% off vs £49.95)
  (6, 3799, 36.65),    -- £37.99 (37% off vs £59.94)
  (7, 4199, 39.91),    -- £41.99 (40% off vs £69.93)
  (8, 4549, 42.94),    -- £45.49 (43% off vs £79.92)
  (9, 4849, 45.66),    -- £48.49 (46% off vs £89.91)
  (10, 5099, 48.95)    -- £50.99 (49% off vs £99.90)
ON CONFLICT (quantity) DO NOTHING;

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

ALTER TABLE public.digital_bundle_tiers ENABLE ROW LEVEL SECURITY;

-- Public can view active bundle tiers
CREATE POLICY "Public can view active bundle tiers"
  ON public.digital_bundle_tiers FOR SELECT
  TO public
  USING (is_active = true);

-- Admin can manage bundle tiers
CREATE POLICY "Admin can manage bundle tiers"
  ON public.digital_bundle_tiers FOR ALL
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

-- ============================================================================
-- MASTER BUNDLE PRODUCT
-- ============================================================================

-- Check if master bundle product already exists
DO $$
DECLARE
  bundle_product_id UUID;
BEGIN
  -- Check for existing master bundle product
  SELECT id INTO bundle_product_id
  FROM public.products
  WHERE name = 'Digital Download Bundle'
  AND product_type = 'digital_download'
  LIMIT 1;

  -- Create if doesn't exist
  IF bundle_product_id IS NULL THEN
    INSERT INTO public.products (
      name,
      description,
      product_type,
      fulfillment_method,
      requires_shipping,
      base_price,
      currency,
      is_active,
      is_public,
      digital_file_type,
      digital_resolution,
      license_type,
      image_count
    ) VALUES (
      'Digital Download Bundle',
      'High-resolution digital download of pet portrait. Purchase multiple images and save with bundle pricing!',
      'digital_download',
      'download',
      false,
      999,  -- £9.99 in pence (single image price)
      'GBP',
      true,
      true,
      'jpg',
      'high',
      'personal',
      1  -- Default to 1, but customers can add multiple to cart
    )
    RETURNING id INTO bundle_product_id;

    RAISE NOTICE '✅ Created master bundle product: %', bundle_product_id;
  ELSE
    RAISE NOTICE 'ℹ️  Master bundle product already exists: %', bundle_product_id;
  END IF;
END $$;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_digital_bundle_tiers_quantity
  ON public.digital_bundle_tiers(quantity);

CREATE INDEX IF NOT EXISTS idx_digital_bundle_tiers_active
  ON public.digital_bundle_tiers(is_active)
  WHERE is_active = true;

-- ============================================================================
-- VALIDATION & SUMMARY
-- ============================================================================

DO $$
DECLARE
  tier_count INTEGER;
  product_count INTEGER;
BEGIN
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
  RAISE NOTICE '📊 Phase 1 Migration Summary:';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '✅ digital_bundle_tiers table: Created';
  RAISE NOTICE '✅ Active pricing tiers: % tiers (1-10 images)', tier_count;
  RAISE NOTICE '✅ Master bundle product: % created', product_count;
  RAISE NOTICE '✅ RLS policies: Configured (public read, admin manage)';
  RAISE NOTICE '✅ Indexes: Created for quantity and active status';
  RAISE NOTICE '';
  RAISE NOTICE '💰 Pricing Structure:';
  RAISE NOTICE '   1 image:  £9.99  (0%% discount)';
  RAISE NOTICE '   2 images: £17.49 (12%% discount)';
  RAISE NOTICE '   3 images: £22.49 (25%% discount)';
  RAISE NOTICE '   10 images: £50.99 (49%% discount)';
  RAISE NOTICE '';
  RAISE NOTICE '🔜 Next Steps:';
  RAISE NOTICE '   1. Implement BundlePricingService in /lib/bundle-pricing-service.ts';
  RAISE NOTICE '   2. Update cart context with bundle pricing calculation';
  RAISE NOTICE '   3. Create DigitalDownloadButton component';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Phase 1 Migration: Digital Bundle Pricing - COMPLETE';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;
