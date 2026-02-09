-- ============================================================================
-- DELETE ARCHIVED IMAGES FROM MAIN CATALOG (COMPREHENSIVE CLEANUP)
-- ============================================================================
-- ⚠️ ONLY run after verification confirms images are safely archived
-- ⚠️ This script will delete 2,608 admin-generated images
-- ============================================================================
-- Archive Operation ID: 338c7f10-a78b-4c5f-9547-11fd897dfcbc
-- Images Archived: 2,608
-- Date: 2026-02-09
-- ============================================================================

BEGIN;

-- ============================================================================
-- Step 0A: Handle image_catalog_subjects foreign key
-- ============================================================================

DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM image_catalog_subjects
  WHERE image_catalog_id IN (
    SELECT original_id FROM image_catalog_archive
  );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '✅ Deleted % image_catalog_subjects records', deleted_count;
END $$;

-- ============================================================================
-- Step 0B: Handle batch_jobs foreign key
-- ============================================================================

DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM batch_jobs
  WHERE original_image_id IN (
    SELECT original_id FROM image_catalog_archive
  );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '✅ Deleted % batch_jobs records', deleted_count;
END $$;

-- ============================================================================
-- Step 0C: Handle referrals foreign key (set to NULL)
-- ============================================================================

DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Set image_id to NULL for referrals pointing to archived images
  -- (Referrals should remain active even if image deleted)
  UPDATE referrals
  SET image_id = NULL
  WHERE image_id IN (
    SELECT original_id FROM image_catalog_archive
  );

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '✅ Nullified % referrals image_id references', updated_count;
END $$;

-- ============================================================================
-- Step 0D: Handle interaction_analytics foreign key
-- ============================================================================

DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM interaction_analytics
  WHERE image_id IN (
    SELECT original_id FROM image_catalog_archive
  );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '✅ Deleted % interaction_analytics records', deleted_count;
END $$;

-- ============================================================================
-- Step 0E: Handle user_interactions foreign key
-- ============================================================================

DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM user_interactions
  WHERE image_id IN (
    SELECT original_id FROM image_catalog_archive
  );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '✅ Deleted % user_interactions records', deleted_count;
END $$;

-- ============================================================================
-- Step 0F: Handle customer_generated_images (if column exists)
-- ============================================================================

DO $$
DECLARE
  deleted_count INTEGER;
  column_exists BOOLEAN;
BEGIN
  -- Check if catalog_image_id column exists
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'customer_generated_images'
    AND column_name = 'catalog_image_id'
  ) INTO column_exists;

  IF column_exists THEN
    DELETE FROM customer_generated_images
    WHERE catalog_image_id IN (
      SELECT original_id FROM image_catalog_archive
    );

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '✅ Deleted % customer_generated_images records', deleted_count;
  ELSE
    RAISE NOTICE 'ℹ️  Skipping customer_generated_images (no catalog_image_id column)';
  END IF;
END $$;

-- ============================================================================
-- Step 1: Delete archived images from main catalog
-- ============================================================================

DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete images that have been archived
  DELETE FROM image_catalog
  WHERE is_customer_generated = false
  AND id IN (
    SELECT original_id
    FROM image_catalog_archive
  );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '✅ Deleted % images from main catalog', deleted_count;
END $$;

-- ============================================================================
-- Step 2: Verify remaining images
-- ============================================================================

SELECT
  (SELECT COUNT(*) FROM image_catalog) as remaining_catalog_images,
  (SELECT COUNT(*) FROM image_catalog WHERE is_customer_generated = true) as customer_images_remaining,
  (SELECT COUNT(*) FROM image_catalog_archive) as archived_images;

-- ============================================================================
-- Step 3: Update archive operation status
-- ============================================================================

UPDATE archive_operations
SET
  status = 'completed',
  completed_at = NOW(),
  metadata = metadata || jsonb_build_object(
    'deletion_completed_at', NOW(),
    'deletion_method', 'manual_sql_comprehensive',
    'analytics_skipped', true,
    'foreign_keys_handled', jsonb_build_array(
      'image_catalog_subjects',
      'batch_jobs',
      'referrals',
      'interaction_analytics',
      'user_interactions'
    )
  )
WHERE id = '338c7f10-a78b-4c5f-9547-11fd897dfcbc';

-- ============================================================================
-- FINAL VERIFICATION
-- ============================================================================

SELECT
  '📊 DELETION SUMMARY' as section,
  '' as metric,
  '' as count;

SELECT
  'Catalog' as section,
  'Images Remaining' as metric,
  COUNT(*)::text as count
FROM image_catalog
UNION ALL
SELECT
  'Catalog' as section,
  'Customer Images (Protected)' as metric,
  COUNT(*)::text as count
FROM image_catalog
WHERE is_customer_generated = true
UNION ALL
SELECT
  'Archive' as section,
  'Archived Images' as metric,
  COUNT(*)::text as count
FROM image_catalog_archive
UNION ALL
SELECT
  'Batch Jobs' as section,
  'Total Batch Jobs' as metric,
  COUNT(*)::text as count
FROM batch_jobs
UNION ALL
SELECT
  'Referrals' as section,
  'Total Referrals' as metric,
  COUNT(*)::text as count
FROM referrals
UNION ALL
SELECT
  'Referrals' as section,
  'Referrals with NULL image_id' as metric,
  COUNT(*)::text as count
FROM referrals
WHERE image_id IS NULL
ORDER BY section, metric;

-- ============================================================================
-- Verify no orphaned records remain
-- ============================================================================

SELECT
  '🔍 ORPHAN CHECK' as check_type,
  '' as result;

SELECT
  'Orphaned Batch Jobs' as check_type,
  CASE
    WHEN COUNT(*) = 0 THEN '✅ None found'
    ELSE '⚠️ ' || COUNT(*)::text || ' orphaned records'
  END as result
FROM batch_jobs
WHERE original_image_id NOT IN (SELECT id FROM image_catalog)
AND original_image_id IS NOT NULL
UNION ALL
SELECT
  'Orphaned Subjects' as check_type,
  CASE
    WHEN COUNT(*) = 0 THEN '✅ None found'
    ELSE '⚠️ ' || COUNT(*)::text || ' orphaned records'
  END as result
FROM image_catalog_subjects
WHERE image_catalog_id NOT IN (SELECT id FROM image_catalog);

COMMIT;

-- ============================================================================
-- Success! Catalog cleaned up.
-- ============================================================================

SELECT '✅ Archive deletion completed successfully!' as status;
