-- Fix Unmigrated Images
-- Purpose: Handle images that weren't migrated because they have NULL breed_id

-- =============================================================================
-- 1. DIAGNOSTIC: FIND UNMIGRATED IMAGES
-- =============================================================================
SELECT 'Diagnostic: Unmigrated Images' as check_name;

-- Find images with empty subjects array
SELECT
  id,
  filename,
  breed_id,
  theme_id,
  style_id,
  coat_id,
  is_customer_generated,
  subjects,
  '❌ Not migrated' as status
FROM public.image_catalog
WHERE subjects = '[]'::jsonb
  AND is_customer_generated = false
LIMIT 10;

-- Count by reason
SELECT
  CASE
    WHEN breed_id IS NULL THEN 'NULL breed_id'
    WHEN subjects = '[]'::jsonb THEN 'Empty subjects array'
    ELSE 'Other'
  END as reason,
  COUNT(*) as count
FROM public.image_catalog
WHERE subjects = '[]'::jsonb
  AND is_customer_generated = false
GROUP BY
  CASE
    WHEN breed_id IS NULL THEN 'NULL breed_id'
    WHEN subjects = '[]'::jsonb THEN 'Empty subjects array'
    ELSE 'Other'
  END;

-- =============================================================================
-- 2. FIX: MIGRATE IMAGES WITH NULL BREED
-- =============================================================================
-- These images should still be archived even without breed information
-- They might be test images, incomplete uploads, or special reference images

DO $$
DECLARE
  fixed_count integer := 0;
BEGIN
  -- Update images with NULL breed_id to have empty but valid subjects structure
  UPDATE public.image_catalog
  SET subjects = jsonb_build_array(
    jsonb_build_object(
      'subject_order', 1,
      'is_primary', true,
      'breed_id', NULL,
      'coat_id', NULL,
      'position', 'center',
      'size_prominence', 'primary',
      'pose_description', 'unknown breed',
      'identified_by_ai', false,
      'ai_confidence', null
    )
  ),
  is_multi_subject = false
  WHERE breed_id IS NULL
    AND subjects = '[]'::jsonb
    AND is_customer_generated = false;

  GET DIAGNOSTICS fixed_count = ROW_COUNT;
  RAISE NOTICE 'Migrated % images with NULL breed_id', fixed_count;

  -- Optionally create junction table entries for these (only if you want them queryable)
  -- Note: These won't be useful for breed filtering, but maintains consistency
  INSERT INTO public.image_catalog_subjects (
    image_id,
    subject_order,
    is_primary,
    breed_id,
    coat_id,
    outfit_id,
    position_in_frame,
    size_prominence,
    identified_by_ai,
    pose_description
  )
  SELECT
    ic.id as image_id,
    1 as subject_order,
    true as is_primary,
    NULL as breed_id,
    NULL as coat_id,
    NULL as outfit_id,
    'center' as position_in_frame,
    'primary' as size_prominence,
    false as identified_by_ai,
    'unknown breed' as pose_description
  FROM public.image_catalog ic
  WHERE ic.breed_id IS NULL
    AND ic.is_customer_generated = false
    AND NOT EXISTS (
      SELECT 1 FROM public.image_catalog_subjects ics
      WHERE ics.image_id = ic.id
    )
  ON CONFLICT (image_id, subject_order) DO NOTHING;

  GET DIAGNOSTICS fixed_count = ROW_COUNT;
  RAISE NOTICE 'Created % junction table entries for NULL breed images', fixed_count;

END $$;

-- =============================================================================
-- 3. VERIFICATION: CHECK ALL IMAGES MIGRATED
-- =============================================================================
SELECT 'Verification: Migration Status After Fix' as check_name;

SELECT
  'Total admin images' as metric,
  COUNT(*) as count
FROM public.image_catalog
WHERE is_customer_generated = false

UNION ALL

SELECT
  'Migrated (with subjects data)',
  COUNT(*)
FROM public.image_catalog
WHERE subjects != '[]'::jsonb
  AND is_customer_generated = false

UNION ALL

SELECT
  'Unmigrated (still empty subjects)',
  COUNT(*)
FROM public.image_catalog
WHERE subjects = '[]'::jsonb
  AND is_customer_generated = false

UNION ALL

SELECT
  'Junction table entries',
  COUNT(*)
FROM public.image_catalog_subjects;

-- Should show:
-- Total admin images: 2604
-- Migrated: 2604 (now matches!)
-- Unmigrated: 0
-- Junction entries: 2604

-- =============================================================================
-- 4. SAMPLE: SHOW FIXED IMAGES
-- =============================================================================
SELECT 'Sample: Fixed Images' as check_name;

SELECT
  id,
  filename,
  breed_id,
  subjects,
  '✅ Now has subjects structure' as status
FROM public.image_catalog
WHERE breed_id IS NULL
  AND subjects != '[]'::jsonb
  AND is_customer_generated = false
LIMIT 5;

SELECT '
╔════════════════════════════════════════════╗
║  MIGRATION FIX COMPLETE                    ║
╚════════════════════════════════════════════╝

✅ All images should now be migrated!

EXPLANATION:
- 53 images had NULL breed_id (incomplete/test images)
- These are now migrated with NULL breed in subjects array
- They will be archived and deleted with the rest
- Junction table entries created for consistency

📋 NEXT STEPS:
   1. Verify counts above show 0 unmigrated
   2. Ready to proceed with Phase 2 implementation
   3. Archive script will handle all 2604 images

' as summary;
