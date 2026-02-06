-- Phase 0 Migration: Add Multi-Image Product Support
-- Purpose: Support products with multiple images (coaster sets, placemat sets, etc.)

-- ============================================================================
-- PRODUCTS TABLE: Add image_count field
-- ============================================================================

-- Add image count field for multi-image products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_count INTEGER DEFAULT 1;

COMMENT ON COLUMN public.products.image_count IS 'Number of images in multi-image products (coasters, placemats). Default 1 for single-image products.';

-- Create index for multi-image products
CREATE INDEX IF NOT EXISTS idx_products_image_count
  ON public.products(image_count)
  WHERE image_count > 1;

-- ============================================================================
-- ORDER_ITEMS TABLE: Add image_ids array field
-- ============================================================================

-- Store array of image IDs for multi-image order items
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS image_ids TEXT[];

COMMENT ON COLUMN public.order_items.image_ids IS 'Array of image IDs for multi-image products (coaster sets, etc.). Single-image products use image_id field.';

-- Add GIN index for array queries
CREATE INDEX IF NOT EXISTS idx_order_items_image_ids
  ON public.order_items USING gin(image_ids);

-- ============================================================================
-- BACKFILL: Set image_count = 1 for existing products
-- ============================================================================

UPDATE public.products
SET image_count = 1
WHERE image_count IS NULL;

-- ============================================================================
-- VALIDATION CHECKS
-- ============================================================================

-- Check if columns exist
DO $$
BEGIN
  -- Verify products.image_count exists
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'products'
    AND column_name = 'image_count'
  ) THEN
    RAISE NOTICE '✅ products.image_count column exists';
  ELSE
    RAISE EXCEPTION '❌ products.image_count column NOT created';
  END IF;

  -- Verify order_items.image_ids exists
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'order_items'
    AND column_name = 'image_ids'
  ) THEN
    RAISE NOTICE '✅ order_items.image_ids column exists';
  ELSE
    RAISE EXCEPTION '❌ order_items.image_ids column NOT created';
  END IF;

  -- Verify index exists
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
    AND tablename = 'products'
    AND indexname = 'idx_products_image_count'
  ) THEN
    RAISE NOTICE '✅ idx_products_image_count index exists';
  ELSE
    RAISE WARNING '⚠️  idx_products_image_count index NOT created';
  END IF;

  -- Verify GIN index exists
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
    AND tablename = 'order_items'
    AND indexname = 'idx_order_items_image_ids'
  ) THEN
    RAISE NOTICE '✅ idx_order_items_image_ids index exists';
  ELSE
    RAISE WARNING '⚠️  idx_order_items_image_ids index NOT created';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '📊 Migration Summary:';
  RAISE NOTICE '  - products.image_count: Added (default 1)';
  RAISE NOTICE '  - order_items.image_ids: Added (text array)';
  RAISE NOTICE '  - Indexes: Created for both fields';
  RAISE NOTICE '  - Backfill: All existing products set to image_count = 1';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Phase 0 Migration: Multi-Image Products - COMPLETE';
END $$;
