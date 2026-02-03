-- Verification Queries for Phase 1 Migrations
-- Run these in Supabase SQL Editor to verify migrations succeeded

-- =============================================================================
-- 1. VERIFY ARCHIVE TABLES EXIST
-- =============================================================================
SELECT 'Archive Tables Check' as test_name;

SELECT
  tablename,
  CASE
    WHEN tablename IN ('image_catalog_archive', 'interaction_analytics_archive', 'user_interactions_archive', 'archive_operations')
    THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('image_catalog_archive', 'interaction_analytics_archive', 'user_interactions_archive', 'archive_operations')
ORDER BY tablename;

-- =============================================================================
-- 2. VERIFY NEW IMAGE_CATALOG COLUMNS
-- =============================================================================
SELECT 'Image Catalog New Columns Check' as test_name;

SELECT
  column_name,
  data_type,
  '✅ EXISTS' as status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'image_catalog'
  AND column_name IN (
    'is_multi_subject',
    'subjects',
    'composition_analysis',
    'composition_metadata',
    'ai_analysis_model',
    'ai_analyzed_at',
    'marketing_description',
    'marketing_description_approved',
    'variation_prompt_template'
  )
ORDER BY column_name;

-- Expected: 9 rows

-- =============================================================================
-- 3. VERIFY JUNCTION TABLE EXISTS
-- =============================================================================
SELECT 'Junction Table Check' as test_name;

SELECT
  tablename,
  '✅ EXISTS' as status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'image_catalog_subjects';

-- Expected: 1 row

-- =============================================================================
-- 4. VERIFY INDEXES CREATED
-- =============================================================================
SELECT 'Indexes Check' as test_name;

SELECT
  tablename,
  indexname,
  '✅ EXISTS' as status
FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    (tablename = 'image_catalog_archive' AND indexname LIKE 'idx_catalog_archive%')
    OR (tablename = 'image_catalog' AND indexname LIKE 'idx_image_catalog_%_gin')
    OR (tablename = 'image_catalog_subjects' AND indexname LIKE 'idx_catalog_subjects%')
    OR tablename IN ('interaction_analytics_archive', 'user_interactions_archive', 'archive_operations')
  )
ORDER BY tablename, indexname;

-- Expected: Multiple index rows

-- =============================================================================
-- 5. CHECK DATA MIGRATION STATUS
-- =============================================================================
SELECT 'Data Migration Status' as test_name;

-- Count total images
SELECT
  'Total catalog images' as metric,
  COUNT(*) as count,
  '📊' as icon
FROM public.image_catalog

UNION ALL

-- Count admin-generated images (to be archived)
SELECT
  'Admin-generated images (to archive)',
  COUNT(*),
  '🎨'
FROM public.image_catalog
WHERE is_customer_generated = false

UNION ALL

-- Count customer-generated images (must preserve)
SELECT
  'Customer-generated images (preserve)',
  COUNT(*),
  '👤'
FROM public.image_catalog
WHERE is_customer_generated = true

UNION ALL

-- Count migrated single-subject images
SELECT
  'Migrated to new subjects structure',
  COUNT(*),
  '✅'
FROM public.image_catalog
WHERE subjects != '[]'::jsonb

UNION ALL

-- Count junction table entries
SELECT
  'Junction table entries',
  COUNT(*),
  '🔗'
FROM public.image_catalog_subjects

UNION ALL

-- Count primary subjects in junction table
SELECT
  'Primary subjects in junction table',
  COUNT(*),
  '⭐'
FROM public.image_catalog_subjects
WHERE is_primary = true;

-- =============================================================================
-- 6. SAMPLE DATA VERIFICATION
-- =============================================================================
SELECT 'Sample Data Verification' as test_name;

-- Show a sample image with its subject data
SELECT
  id,
  filename,
  is_multi_subject,
  subjects,
  breed_id as original_breed_id,
  '📸 Sample with subjects JSONB' as note
FROM public.image_catalog
WHERE breed_id IS NOT NULL
LIMIT 3;

-- Show sample junction table entries
SELECT
  ics.image_id,
  ics.subject_order,
  ics.is_primary,
  b.name as breed_name,
  c.name as coat_name,
  ics.position_in_frame,
  ics.size_prominence,
  '🔗 Sample junction entries' as note
FROM public.image_catalog_subjects ics
LEFT JOIN public.breeds b ON ics.breed_id = b.id
LEFT JOIN public.coats c ON ics.coat_id = c.id
LIMIT 5;

-- =============================================================================
-- 7. PERMISSIONS CHECK
-- =============================================================================
SELECT 'Permissions Check' as test_name;

SELECT
  grantee,
  table_name,
  string_agg(privilege_type, ', ') as privileges,
  '🔒' as icon
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'image_catalog_archive',
    'interaction_analytics_archive',
    'user_interactions_archive',
    'archive_operations',
    'image_catalog_subjects'
  )
  AND grantee IN ('authenticated', 'service_role')
GROUP BY grantee, table_name
ORDER BY table_name, grantee;

-- =============================================================================
-- SUMMARY
-- =============================================================================
SELECT '
╔════════════════════════════════════════════╗
║  MIGRATION VERIFICATION COMPLETE           ║
╚════════════════════════════════════════════╝

✅ If all checks above show:
   - 4 archive tables exist
   - 9 new columns in image_catalog
   - Junction table exists with data
   - Indexes created
   - Existing images migrated to new structure

THEN migrations are successful!

📋 NEXT STEPS:
   1. Review the counts above
   2. If everything looks good, ready to proceed with Phase 2
   3. Archive script will be run later before deletion

' as summary;
