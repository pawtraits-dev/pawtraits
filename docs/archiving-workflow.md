# Image Catalog Archiving Workflow

## Overview

This document provides step-by-step instructions for archiving admin-generated images from the catalog. The archiving infrastructure is fully built and tested, ready for production use.

### Purpose
- **Catalog pivot**: Moving from AI-generated catalog to curated, high-quality images
- **Data cleanup**: Archive old admin-generated images while preserving customer data
- **90-day rollback**: Full recovery capability within 90-day window

### What Gets Archived
- **Admin-generated images** (`is_customer_generated = false`)
- Associated analytics data
- User interaction history
- Full metadata preservation

### Safety Features
- ✅ Customer images are NEVER archived (`is_customer_generated = true`)
- ✅ 90-day rollback window with automatic script generation
- ✅ 8-point integrity verification before deletion
- ✅ Batch processing with progress tracking
- ✅ Complete audit trail in `archive_operations` table

---

## Pre-Archival Checklist

Before running the archival process, verify:

- [ ] **Environment variables set correctly**:
  ```bash
  echo $NEXT_PUBLIC_SUPABASE_URL
  echo $SUPABASE_SERVICE_ROLE_KEY
  ```

- [ ] **Database connection works**:
  ```bash
  # Test connection
  tsx scripts/archive-old-catalog.ts --dry-run
  ```

- [ ] **Review images to be archived**:
  ```sql
  -- Count images that will be archived
  SELECT COUNT(*)
  FROM image_catalog
  WHERE is_customer_generated = false;

  -- Sample images to be archived
  SELECT id, filename, created_at, is_customer_generated
  FROM image_catalog
  WHERE is_customer_generated = false
  ORDER BY created_at DESC
  LIMIT 10;
  ```

- [ ] **Optional: Backup database** (recommended for first archival)
  - Create Supabase backup via dashboard
  - Or export data: `pg_dump` if self-hosted

---

## Step 1: Run Archival Script

### Execute Archival

```bash
# Navigate to project root
cd /path/to/pawtraits-fresh

# Run archival script
tsx scripts/archive-old-catalog.ts
```

### What Happens During Archival

The script performs these operations:

1. **Archive Images** (batch size: 100)
   - Copies from `image_catalog` → `image_catalog_archive`
   - Preserves all metadata, relationships, and timestamps
   - Adds archive context: `archived_at`, `archived_by`, `archive_reason`

2. **Archive Analytics** (batch size: 500)
   - Copies from `interaction_analytics` → `interaction_analytics_archive`
   - Maintains link to archived images via `archived_image_id`

3. **Archive User Interactions** (batch size: 500)
   - Copies from `user_interactions` → `user_interactions_archive`
   - Preserves user activity history

4. **Create Archive Operation Record**
   - Logs operation details in `archive_operations` table
   - Generates rollback SQL script
   - Sets 90-day rollback deadline

5. **Generate Rollback Script**
   - Automatic SQL script stored in `archive_operations.metadata`
   - Path: `/db/rollback/archive_rollback_YYYY-MM-DD.sql` (virtual)
   - Can be executed to restore all archived data

### Monitor Progress

The script outputs detailed progress:
```
🚀 Starting catalog archive operation...
📊 Found 1,234 admin-generated images to archive
⏳ Archiving images (batch 1/13)...
✅ Archived 100 images
⏳ Archiving images (batch 2/13)...
...
✅ Image archival complete: 1,234 images
📈 Archiving analytics...
✅ Analytics archived: 5,678 records
👥 Archiving user interactions...
✅ User interactions archived: 12,345 records
📋 Creating archive operation record...
✅ Archive operation complete!
```

### Archive Operation Record

After completion, query the operation details:

```sql
SELECT
  id,
  operation_type,
  images_archived,
  analytics_archived,
  interactions_archived,
  started_at,
  completed_at,
  rollback_deadline,
  status
FROM archive_operations
ORDER BY started_at DESC
LIMIT 1;
```

**Save the operation ID** - you'll need it for rollback if necessary.

---

## Step 2: Verify Archive Integrity (REQUIRED)

**⚠️ CRITICAL**: You MUST run verification before deleting any data.

### Execute Verification Script

```bash
tsx scripts/verify-archive-integrity.ts
```

### 8-Point Verification Checklist

The script performs these checks:

1. ✅ **Archive tables exist**
   - Verifies `image_catalog_archive`, `interaction_analytics_archive`, `user_interactions_archive` tables exist

2. ✅ **Image counts match**
   - Compares count of archived images to original images
   - Ensures no data loss during archival

3. ✅ **Image data integrity** (samples 10 images)
   - Validates critical fields: `filename`, `cloudinary_public_id`, `prompt_text`
   - Checks metadata preservation: `breed_id`, `theme_id`, `style_id`
   - Ensures timestamps match

4. ✅ **Analytics counts match**
   - Verifies all analytics records archived
   - Checks foreign key references valid

5. ✅ **User interactions counts match**
   - Confirms all interaction history preserved
   - Validates linked to correct archived images

6. ✅ **Foreign key references valid**
   - Ensures `archived_image_id` links work
   - Checks referential integrity

7. ✅ **Archive operation record exists**
   - Confirms operation logged in `archive_operations`
   - Validates metadata and rollback script present

8. ✅ **Customer data safety** (CRITICAL)
   - **Verifies NO customer images in archive**
   - Ensures `is_customer_generated = false` for all archived images
   - Protects customer data from accidental deletion

### Verification Output

```
🔍 Starting archive integrity verification...

✅ Check 1/8: Archive tables exist
✅ Check 2/8: Image counts match (1,234 images)
✅ Check 3/8: Image data integrity (sampled 10 images)
✅ Check 4/8: Analytics counts match (5,678 records)
✅ Check 5/8: User interactions counts match (12,345 records)
✅ Check 6/8: Foreign key references valid
✅ Check 7/8: Archive operation record exists
✅ Check 8/8: Customer data safety verified (0 customer images in archive)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ ALL VERIFICATION CHECKS PASSED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🟢 Safe to proceed with deletion
```

### Exit Codes

- **Exit code 0**: All checks passed ✅ (safe to delete)
- **Exit code 1**: Verification failed ❌ (DO NOT PROCEED)

**If verification fails**: Do NOT delete any data. Investigate the issue, fix it, and re-run archival if necessary.

---

## Step 3: Delete Archived Images (Execute SQL in Supabase)

**⚠️ ONLY proceed if verification passed (exit code 0)**

### Execute Deletion in Supabase SQL Editor

1. Open Supabase Dashboard → SQL Editor
2. Create new query
3. Copy and execute the following SQL:

```sql
-- ============================================================================
-- DELETE ARCHIVED IMAGES FROM MAIN CATALOG
-- ⚠️ ONLY run after verification passes!
-- ============================================================================

-- Step 1: Delete archived images from main catalog
-- This removes images that have been safely archived
DELETE FROM image_catalog
WHERE is_customer_generated = false
AND id IN (
  SELECT image_catalog_id
  FROM image_catalog_archive
);

-- Check deleted count
SELECT
  (SELECT COUNT(*) FROM image_catalog) as remaining_catalog_images,
  (SELECT COUNT(*) FROM image_catalog_archive) as archived_images;

-- Step 2: Clean up orphaned analytics
-- Remove analytics for images that no longer exist in main catalog
DELETE FROM interaction_analytics
WHERE image_id NOT IN (
  SELECT id FROM image_catalog
);

-- Check orphaned analytics removed
SELECT COUNT(*) as orphaned_analytics_removed
FROM interaction_analytics
WHERE image_id NOT IN (SELECT id FROM image_catalog);

-- Step 3: Clean up orphaned user interactions
-- Remove interactions for images that no longer exist in main catalog
DELETE FROM user_interactions
WHERE image_id NOT IN (
  SELECT id FROM image_catalog
);

-- Check orphaned interactions removed
SELECT COUNT(*) as orphaned_interactions_removed
FROM user_interactions
WHERE image_id NOT IN (SELECT id FROM image_catalog);

-- ============================================================================
-- FINAL VERIFICATION
-- ============================================================================

SELECT
  'Catalog Images Remaining' as metric,
  COUNT(*) as count
FROM image_catalog
UNION ALL
SELECT
  'Customer Images (should be unchanged)' as metric,
  COUNT(*) as count
FROM image_catalog
WHERE is_customer_generated = true
UNION ALL
SELECT
  'Archived Images' as metric,
  COUNT(*) as count
FROM image_catalog_archive
UNION ALL
SELECT
  'Active Analytics' as metric,
  COUNT(*) as count
FROM interaction_analytics
UNION ALL
SELECT
  'Archived Analytics' as metric,
  COUNT(*) as count
FROM interaction_analytics_archive
UNION ALL
SELECT
  'Active Interactions' as metric,
  COUNT(*) as count
FROM user_interactions
UNION ALL
SELECT
  'Archived Interactions' as metric,
  COUNT(*) as count
FROM user_interactions_archive;
```

### Expected Results

After deletion, you should see:
- **Catalog images**: Only customer images + new curated admin images remain
- **Customer images**: Unchanged (protected)
- **Archived images**: All old admin images safely stored
- **Analytics/Interactions**: Cleaned up, no orphaned records

---

## Step 4: Post-Deletion Verification

After deletion, verify the catalog state:

```sql
-- Verify customer images untouched
SELECT COUNT(*) as customer_images_count
FROM image_catalog
WHERE is_customer_generated = true;
-- Should match pre-archival count

-- Verify admin images archived correctly
SELECT COUNT(*) as archived_admin_images
FROM image_catalog_archive
WHERE is_customer_generated = false;
-- Should match archival operation count

-- Check for any orphaned records
SELECT COUNT(*) as orphaned_analytics
FROM interaction_analytics
WHERE image_id NOT IN (SELECT id FROM image_catalog);
-- Should be 0

SELECT COUNT(*) as orphaned_interactions
FROM user_interactions
WHERE image_id NOT IN (SELECT id FROM image_catalog);
-- Should be 0
```

---

## Rollback Procedure (Within 90 Days)

If you need to restore archived images (disaster recovery):

### Step 1: Retrieve Rollback Script

```sql
-- Get the rollback script from archive operation
SELECT
  id as operation_id,
  started_at,
  rollback_deadline,
  (rollback_deadline > NOW()) as can_still_rollback,
  metadata->'rollback_script' as rollback_sql
FROM archive_operations
WHERE operation_type = 'archive'
ORDER BY started_at DESC
LIMIT 1;
```

**Copy the `rollback_sql` content** (it will be a complete SQL script).

### Step 2: Execute Rollback

1. Open Supabase SQL Editor
2. Paste the rollback SQL script
3. Execute

The rollback script will:
- Restore all archived images to `image_catalog`
- Restore analytics to `interaction_analytics`
- Restore interactions to `user_interactions`
- Mark archive operation as rolled back

### Step 3: Verify Rollback

```sql
-- Verify images restored
SELECT COUNT(*) as restored_images
FROM image_catalog
WHERE is_customer_generated = false;

-- Check archive operation status
SELECT
  id,
  status,
  can_rollback,
  rollback_deadline
FROM archive_operations
ORDER BY started_at DESC
LIMIT 1;
```

### Rollback Deadline

- **90 days** from archival date
- After deadline, rollback is no longer possible
- Query to check remaining time:

```sql
SELECT
  rollback_deadline,
  rollback_deadline - NOW() as time_remaining,
  (rollback_deadline > NOW()) as still_rollbackable
FROM archive_operations
WHERE operation_type = 'archive'
ORDER BY started_at DESC
LIMIT 1;
```

---

## Monitoring & Maintenance

### View Archive Operations History

```sql
SELECT
  id,
  operation_type,
  images_archived,
  analytics_archived,
  interactions_archived,
  started_at,
  completed_at,
  status,
  can_rollback,
  rollback_deadline,
  CASE
    WHEN rollback_deadline > NOW() THEN 'Active'
    ELSE 'Expired'
  END as rollback_status
FROM archive_operations
ORDER BY started_at DESC;
```

### Archive Storage Size

```sql
-- Estimate archive storage
SELECT
  'Image Catalog Archive' as table_name,
  pg_size_pretty(pg_total_relation_size('image_catalog_archive')) as size
UNION ALL
SELECT
  'Analytics Archive' as table_name,
  pg_size_pretty(pg_total_relation_size('interaction_analytics_archive')) as size
UNION ALL
SELECT
  'Interactions Archive' as table_name,
  pg_size_pretty(pg_total_relation_size('user_interactions_archive')) as size;
```

### Permanent Deletion (After 90 Days)

After the rollback deadline expires, you can permanently delete archive data to free storage:

```sql
-- ⚠️ ONLY run after rollback deadline expired
-- This is PERMANENT and IRREVERSIBLE

-- Verify deadline expired first
SELECT
  id,
  rollback_deadline,
  (rollback_deadline < NOW()) as safe_to_delete
FROM archive_operations
WHERE operation_type = 'archive'
AND rollback_deadline < NOW();

-- If safe_to_delete = true, proceed:
DELETE FROM image_catalog_archive;
DELETE FROM interaction_analytics_archive;
DELETE FROM user_interactions_archive;

-- Update archive operation status
UPDATE archive_operations
SET
  can_rollback = false,
  status = 'permanently_deleted',
  metadata = metadata || '{"permanently_deleted_at": "' || NOW()::text || '"}'::jsonb
WHERE rollback_deadline < NOW();
```

---

## Troubleshooting

### Issue: Verification Failed

**Symptoms**: `verify-archive-integrity.ts` exits with code 1

**Resolution**:
1. Review error message to identify which check failed
2. Common issues:
   - Image count mismatch: Re-run archival script
   - Data integrity failure: Check database constraints
   - Customer images in archive: **CRITICAL** - fix immediately
3. Do NOT proceed with deletion until all checks pass

### Issue: Archive Script Times Out

**Symptoms**: Script hangs or takes very long

**Resolution**:
1. Check database connection
2. Verify batch sizes (may need adjustment for very large datasets)
3. Monitor Supabase dashboard for connection limits
4. Consider archiving in smaller batches

### Issue: Rollback Script Not Found

**Symptoms**: Cannot retrieve rollback SQL from metadata

**Resolution**:
1. Check archive operation record exists:
   ```sql
   SELECT * FROM archive_operations ORDER BY started_at DESC LIMIT 1;
   ```
2. Verify metadata field contains rollback script
3. If missing, manual restoration required (contact support)

### Issue: Customer Images Accidentally Archived

**Symptoms**: Verification check 8 fails

**Resolution**:
1. **STOP IMMEDIATELY** - do not delete anything
2. This should never happen due to `is_customer_generated = false` filter
3. Investigate how customer images got flagged incorrectly
4. Fix data integrity issue
5. Re-run archival after correction

---

## Safety Checklist Summary

Before running archival:
- ✅ Environment variables configured
- ✅ Database backup created (optional but recommended)
- ✅ Reviewed images to be archived
- ✅ Understand rollback procedure

After running archival:
- ✅ Verification script passed (exit code 0)
- ✅ Archive operation record exists
- ✅ Rollback script saved
- ✅ Customer images confirmed untouched

After deletion:
- ✅ Post-deletion verification passed
- ✅ No orphaned records
- ✅ Customer images still intact
- ✅ Archive operation logged

---

## Support

**Archive Infrastructure Files**:
- `/scripts/archive-old-catalog.ts` - Main archival script (665 lines)
- `/scripts/verify-archive-integrity.ts` - Verification script (614 lines)

**Database Tables**:
- `archive_operations` - Operation audit trail
- `image_catalog_archive` - Archived images
- `interaction_analytics_archive` - Archived analytics
- `user_interactions_archive` - Archived interactions

**Default Settings**:
- Archive reason: "Catalog pivot to curated approach"
- Rollback window: 90 days
- Image batch size: 100
- Analytics/interactions batch size: 500

For issues or questions, consult the script source code or database schema documentation.
