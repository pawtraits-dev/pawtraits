-- ============================================================================
-- DELETE ARCHIVED IMAGES FROM MAIN CATALOG (WITH BATCH JOBS CLEANUP)
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
-- Step 0: Handle batch_jobs foreign key references
-- ============================================================================

DO $$
DECLARE
  deleted_count INTEGER;
  nullified_count INTEGER;
BEGIN
  -- Option A: Delete batch jobs for archived images (if they're old/completed)
  DELETE FROM batch_jobs
  WHERE original_image_id IN (
    SELECT original_id FROM image_catalog_archive
  );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '✅ Deleted % batch job records for archived images', deleted_count;

  -- Option B: Set to NULL for any remaining (shouldn't be any after delete)
  UPDATE batch_jobs
  SET original_image_id = NULL
  WHERE original_image_id IN (
    SELECT original_id FROM image_catalog_archive
  );

  GET DIAGNOSTICS nullified_count = ROW_COUNT;
  IF nullified_count > 0 THEN
    RAISE NOTICE '✅ Nullified % batch job references', nullified_count;
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

-- Verify remaining images
SELECT
  (SELECT COUNT(*) FROM image_catalog) as remaining_catalog_images,
  (SELECT COUNT(*) FROM image_catalog WHERE is_customer_generated = true) as customer_images_remaining,
  (SELECT COUNT(*) FROM image_catalog_archive) as archived_images;

-- ============================================================================
-- Step 2: Clean up orphaned analytics
-- ============================================================================

DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Remove analytics for images that no longer exist in main catalog
  DELETE FROM interaction_analytics
  WHERE image_id NOT IN (
    SELECT id FROM image_catalog
  );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '✅ Cleaned up % orphaned analytics records', deleted_count;
END $$;

-- ============================================================================
-- Step 3: Clean up orphaned user interactions
-- ============================================================================

DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Remove interactions for images that no longer exist in main catalog
  DELETE FROM user_interactions
  WHERE image_id NOT IN (
    SELECT id FROM image_catalog
  );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '✅ Cleaned up % orphaned interaction records', deleted_count;
END $$;

-- ============================================================================
-- Step 4: Update archive operation status
-- ============================================================================

UPDATE archive_operations
SET
  status = 'completed',
  completed_at = NOW(),
  metadata = metadata || jsonb_build_object(
    'deletion_completed_at', NOW(),
    'deletion_method', 'manual_sql',
    'analytics_skipped', true,
    'batch_jobs_cleaned', true
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
  'Analytics' as section,
  'Active Analytics' as metric,
  COUNT(*)::text as count
FROM interaction_analytics
UNION ALL
SELECT
  'Interactions' as section,
  'Active Interactions' as metric,
  COUNT(*)::text as count
FROM user_interactions
UNION ALL
SELECT
  'Batch Jobs' as section,
  'Active Batch Jobs' as metric,
  COUNT(*)::text as count
FROM batch_jobs
ORDER BY section, metric;

-- ============================================================================
-- Verify no orphaned records remain
-- ============================================================================

SELECT
  '🔍 ORPHAN CHECK' as check_type,
  '' as result;

SELECT
  'Orphaned Analytics' as check_type,
  CASE
    WHEN COUNT(*) = 0 THEN '✅ None found'
    ELSE '⚠️ ' || COUNT(*)::text || ' orphaned records'
  END as result
FROM interaction_analytics
WHERE image_id NOT IN (SELECT id FROM image_catalog)
UNION ALL
SELECT
  'Orphaned Interactions' as check_type,
  CASE
    WHEN COUNT(*) = 0 THEN '✅ None found'
    ELSE '⚠️ ' || COUNT(*)::text || ' orphaned records'
  END as result
FROM user_interactions
WHERE image_id NOT IN (SELECT id FROM image_catalog)
UNION ALL
SELECT
  'Orphaned Batch Jobs' as check_type,
  CASE
    WHEN COUNT(*) = 0 THEN '✅ None found'
    ELSE '⚠️ ' || COUNT(*)::text || ' orphaned records'
  END as result
FROM batch_jobs
WHERE original_image_id NOT IN (SELECT id FROM image_catalog)
AND original_image_id IS NOT NULL;

COMMIT;

-- ============================================================================
-- Success! Catalog cleaned up.
-- ============================================================================

SELECT '✅ Archive deletion completed successfully!' as status;
