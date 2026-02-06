-- ============================================================================
-- Fix Digital Bundle Product - Add Digital Medium and Format
-- ============================================================================

-- Step 1: Create "Digital" medium if it doesn't exist
INSERT INTO public.media (
  name,
  description,
  is_active,
  sort_order
) VALUES (
  'Digital',
  'Digital download - high-resolution image file',
  true,
  999
)
ON CONFLICT DO NOTHING;

-- Step 2: Create "Digital" format if it doesn't exist (square aspect ratio for flexibility)
INSERT INTO public.formats (
  name,
  aspect_ratio,
  orientation,
  is_active
) VALUES (
  'Digital File',
  1.0,
  'square',
  true
)
ON CONFLICT DO NOTHING;

-- Step 3: Update the digital bundle product with valid medium and format IDs
DO $$
DECLARE
  digital_medium_id UUID;
  digital_format_id UUID;
BEGIN
  -- Get the Digital medium ID
  SELECT id INTO digital_medium_id
  FROM public.media
  WHERE name = 'Digital'
  LIMIT 1;

  -- Get a digital format ID (any format will work since digital can be any aspect ratio)
  SELECT id INTO digital_format_id
  FROM public.formats
  WHERE name = 'Digital File'
  LIMIT 1;

  -- If we couldn't find digital format, use any active format
  IF digital_format_id IS NULL THEN
    SELECT id INTO digital_format_id
    FROM public.formats
    WHERE is_active = true
    LIMIT 1;
  END IF;

  -- Update the digital bundle product
  UPDATE public.products
  SET
    medium_id = digital_medium_id,
    format_id = digital_format_id
  WHERE product_type = 'digital_download'
  AND (medium_id IS NULL OR format_id IS NULL OR
       NOT EXISTS (SELECT 1 FROM media WHERE id = products.medium_id) OR
       NOT EXISTS (SELECT 1 FROM formats WHERE id = products.format_id));

  RAISE NOTICE '✅ Updated digital bundle product with valid medium and format';
END $$;

-- Step 4: Verify the fix
DO $$
DECLARE
  product_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO product_count
  FROM public.products p
  INNER JOIN public.media m ON p.medium_id = m.id
  INNER JOIN public.formats f ON p.format_id = f.id
  WHERE p.product_type = 'digital_download'
  AND p.is_active = true;

  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '📊 DIGITAL BUNDLE PRODUCT FIX - VERIFICATION';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Digital bundle products with valid medium/format: %', product_count;
  RAISE NOTICE '';

  IF product_count = 0 THEN
    RAISE WARNING '❌ No digital products found with valid medium/format!';
    RAISE WARNING 'Please check your media and formats tables.';
  ELSE
    RAISE NOTICE '✅ Digital bundle product is now visible in product listings';
  END IF;

  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;
