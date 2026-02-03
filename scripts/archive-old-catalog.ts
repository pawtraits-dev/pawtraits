/**
 * Archive Old Catalog Script
 *
 * Archives all existing image_catalog data to archive tables before deletion.
 * This creates a complete backup with 90-day retention and rollback capability.
 *
 * Usage: tsx scripts/archive-old-catalog.ts
 *
 * CRITICAL: Run this BEFORE deleting any catalog data!
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Environment validation
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Initialize Supabase client with service role
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

interface ArchiveStats {
  imagesTotal: number;
  imagesArchived: number;
  analyticsArchived: number;
  interactionsArchived: number;
  startTime: Date;
  endTime?: Date;
  operationId?: string;
  errors: string[];
}

const stats: ArchiveStats = {
  imagesTotal: 0,
  imagesArchived: 0,
  analyticsArchived: 0,
  interactionsArchived: 0,
  startTime: new Date(),
  errors: []
};

/**
 * Create archive operation record
 */
async function createArchiveOperation(): Promise<string> {
  console.log('📝 Creating archive operation record...');

  const { data, error } = await supabase
    .from('archive_operations')
    .insert({
      operation_type: 'catalog_archival',
      started_at: stats.startTime.toISOString(),
      status: 'in_progress',
      metadata: {
        script_version: '1.0.0',
        environment: process.env.NODE_ENV || 'production'
      }
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create archive operation: ${error.message}`);
  }

  console.log(`✅ Archive operation created: ${data.id}`);
  return data.id;
}

/**
 * Get count of images to archive
 */
async function getImageCount(): Promise<number> {
  console.log('🔢 Counting images to archive...');

  const { count, error } = await supabase
    .from('image_catalog')
    .select('id', { count: 'exact', head: true })
    .eq('is_customer_generated', false);

  if (error) {
    throw new Error(`Failed to count images: ${error.message}`);
  }

  console.log(`📊 Found ${count} admin-generated images to archive`);
  return count || 0;
}

/**
 * Archive image_catalog records in batches
 */
async function archiveImageCatalog(operationId: string): Promise<number> {
  console.log('\n📦 Archiving image_catalog records...');

  const batchSize = 100;
  let offset = 0;
  let totalArchived = 0;

  while (true) {
    // Fetch batch of images
    const { data: images, error: fetchError } = await supabase
      .from('image_catalog')
      .select('*')
      .eq('is_customer_generated', false)
      .range(offset, offset + batchSize - 1);

    if (fetchError) {
      stats.errors.push(`Batch fetch error at offset ${offset}: ${fetchError.message}`);
      console.error(`❌ Error fetching batch: ${fetchError.message}`);
      break;
    }

    if (!images || images.length === 0) {
      break; // No more images
    }

    // Transform to archive format
    const archiveRecords = images.map(img => ({
      original_id: img.id,
      archived_at: new Date().toISOString(),
      archived_by: null, // Script execution, no specific user
      archive_reason: 'Catalog pivot to curated approach',

      // Original columns
      filename: img.filename,
      original_filename: img.original_filename,
      file_size: img.file_size,
      mime_type: img.mime_type,
      storage_path: img.storage_path,
      public_url: img.public_url,
      prompt_text: img.prompt_text,
      description: img.description,
      tags: img.tags,
      breed_id: img.breed_id,
      theme_id: img.theme_id,
      style_id: img.style_id,
      format_id: img.format_id,
      coat_id: img.coat_id,
      ai_model: img.ai_model,
      generation_parameters: img.generation_parameters,
      rating: img.rating,
      is_featured: img.is_featured,
      is_public: img.is_public,
      share_count: img.share_count,
      last_shared_at: img.last_shared_at,
      like_count: img.like_count,
      view_count: img.view_count,
      last_liked_at: img.last_liked_at,
      last_viewed_at: img.last_viewed_at,
      cloudinary_public_id: img.cloudinary_public_id,
      cloudinary_version: img.cloudinary_version,
      cloudinary_signature: img.cloudinary_signature,
      image_variants: img.image_variants,
      access_level: img.access_level,
      migration_status: img.migration_status,
      migrated_at: img.migrated_at,
      created_by_customer_id: img.created_by_customer_id,
      is_customer_generated: img.is_customer_generated,

      // Original timestamps
      original_created_at: img.created_at,
      original_updated_at: img.updated_at,

      // Interaction snapshot (empty for now, could be populated from analytics)
      interaction_snapshot: {}
    }));

    // Insert into archive
    const { error: insertError } = await supabase
      .from('image_catalog_archive')
      .insert(archiveRecords);

    if (insertError) {
      stats.errors.push(`Batch insert error at offset ${offset}: ${insertError.message}`);
      console.error(`❌ Error archiving batch: ${insertError.message}`);
      break;
    }

    totalArchived += images.length;
    offset += batchSize;

    // Progress update
    const progress = Math.round((totalArchived / stats.imagesTotal) * 100);
    console.log(`  ✓ Archived ${totalArchived}/${stats.imagesTotal} images (${progress}%)`);
  }

  return totalArchived;
}

/**
 * Archive interaction_analytics records
 */
async function archiveInteractionAnalytics(): Promise<number> {
  console.log('\n📊 Archiving interaction_analytics records...');

  // Get archived image IDs mapping
  const { data: archivedImages, error: mapError } = await supabase
    .from('image_catalog_archive')
    .select('id, original_id');

  if (mapError) {
    throw new Error(`Failed to fetch archived images: ${mapError.message}`);
  }

  const imageIdMap = new Map(archivedImages?.map(img => [img.original_id, img.id]) || []);

  // Fetch analytics for archived images
  const { data: analytics, error: fetchError } = await supabase
    .from('interaction_analytics')
    .select('*')
    .in('image_id', Array.from(imageIdMap.keys()));

  if (fetchError) {
    throw new Error(`Failed to fetch analytics: ${fetchError.message}`);
  }

  if (!analytics || analytics.length === 0) {
    console.log('  ℹ️  No analytics records to archive');
    return 0;
  }

  // Transform to archive format
  const archiveRecords = analytics.map(analytic => ({
    original_id: analytic.id,
    archived_image_id: imageIdMap.get(analytic.image_id),
    total_likes: analytic.total_likes,
    total_unlikes: analytic.total_unlikes,
    net_likes: analytic.net_likes,
    total_shares: analytic.total_shares,
    total_views: analytic.total_views,
    unique_users: analytic.unique_users,
    unique_likers: analytic.unique_likers,
    unique_sharers: analytic.unique_sharers,
    unique_viewers: analytic.unique_viewers,
    first_interaction_at: analytic.first_interaction_at,
    last_interaction_at: analytic.last_interaction_at,
    original_updated_at: analytic.updated_at,
    archived_at: new Date().toISOString()
  }));

  // Insert into archive
  const { error: insertError } = await supabase
    .from('interaction_analytics_archive')
    .insert(archiveRecords);

  if (insertError) {
    throw new Error(`Failed to archive analytics: ${insertError.message}`);
  }

  console.log(`  ✓ Archived ${analytics.length} analytics records`);
  return analytics.length;
}

/**
 * Archive user_interactions records in batches
 */
async function archiveUserInteractions(): Promise<number> {
  console.log('\n👥 Archiving user_interactions records...');

  // Get archived image IDs mapping
  const { data: archivedImages, error: mapError } = await supabase
    .from('image_catalog_archive')
    .select('id, original_id');

  if (mapError) {
    throw new Error(`Failed to fetch archived images: ${mapError.message}`);
  }

  const imageIdMap = new Map(archivedImages?.map(img => [img.original_id, img.id]) || []);
  const originalImageIds = Array.from(imageIdMap.keys());

  const batchSize = 500;
  let totalArchived = 0;

  // Process in batches (user_interactions can be very large)
  for (let i = 0; i < originalImageIds.length; i += batchSize) {
    const batchIds = originalImageIds.slice(i, i + batchSize);

    // Fetch interactions for this batch
    const { data: interactions, error: fetchError } = await supabase
      .from('user_interactions')
      .select('*')
      .in('image_id', batchIds);

    if (fetchError) {
      stats.errors.push(`Batch interactions fetch error: ${fetchError.message}`);
      console.error(`❌ Error fetching interactions: ${fetchError.message}`);
      continue;
    }

    if (!interactions || interactions.length === 0) {
      continue;
    }

    // Transform to archive format
    const archiveRecords = interactions.map(interaction => ({
      original_id: interaction.id,
      archived_image_id: imageIdMap.get(interaction.image_id),
      user_id: interaction.user_id,
      session_id: interaction.session_id,
      interaction_type: interaction.interaction_type,
      platform: interaction.platform,
      user_agent: interaction.user_agent,
      ip_address: interaction.ip_address,
      referrer: interaction.referrer,
      metadata: interaction.metadata,
      original_created_at: interaction.created_at,
      archived_at: new Date().toISOString()
    }));

    // Insert into archive
    const { error: insertError } = await supabase
      .from('user_interactions_archive')
      .insert(archiveRecords);

    if (insertError) {
      stats.errors.push(`Batch interactions insert error: ${insertError.message}`);
      console.error(`❌ Error archiving interactions: ${insertError.message}`);
      continue;
    }

    totalArchived += interactions.length;
    console.log(`  ✓ Archived ${totalArchived} interaction records...`);
  }

  console.log(`  ✓ Total interactions archived: ${totalArchived}`);
  return totalArchived;
}

/**
 * Update archive operation with final stats
 */
async function updateArchiveOperation(
  operationId: string,
  status: 'completed' | 'failed'
): Promise<void> {
  console.log(`\n📝 Updating archive operation status to: ${status}`);

  const { error } = await supabase
    .from('archive_operations')
    .update({
      completed_at: new Date().toISOString(),
      images_archived: stats.imagesArchived,
      analytics_archived: stats.analyticsArchived,
      interactions_archived: stats.interactionsArchived,
      status,
      error_message: stats.errors.length > 0 ? stats.errors.join('\n') : null,
      metadata: {
        script_version: '1.0.0',
        environment: process.env.NODE_ENV || 'production',
        duration_seconds: stats.endTime
          ? (stats.endTime.getTime() - stats.startTime.getTime()) / 1000
          : 0,
        error_count: stats.errors.length
      }
    })
    .eq('id', operationId);

  if (error) {
    console.error(`❌ Failed to update operation: ${error.message}`);
  }
}

/**
 * Generate rollback script
 */
function generateRollbackScript(operationId: string): string {
  const timestamp = new Date().toISOString().split('T')[0];
  const scriptPath = path.join(__dirname, `../db/rollback/archive_rollback_${timestamp}.sql`);

  const rollbackSQL = `-- Rollback Archive Operation: ${operationId}
-- Generated: ${new Date().toISOString()}
--
-- This script restores archived data back to the main tables
-- CRITICAL: Only run this if you need to undo the catalog deletion
--
-- WARNING: This will restore ${stats.imagesArchived} images and all associated data

BEGIN;

-- Restore image_catalog records
INSERT INTO public.image_catalog (
  id,
  filename,
  original_filename,
  file_size,
  mime_type,
  storage_path,
  public_url,
  prompt_text,
  description,
  tags,
  breed_id,
  theme_id,
  style_id,
  format_id,
  coat_id,
  ai_model,
  generation_parameters,
  rating,
  is_featured,
  is_public,
  share_count,
  last_shared_at,
  like_count,
  view_count,
  last_liked_at,
  last_viewed_at,
  cloudinary_public_id,
  cloudinary_version,
  cloudinary_signature,
  image_variants,
  access_level,
  migration_status,
  migrated_at,
  created_by_customer_id,
  is_customer_generated,
  created_at,
  updated_at
)
SELECT
  original_id,
  filename,
  original_filename,
  file_size,
  mime_type,
  storage_path,
  public_url,
  prompt_text,
  description,
  tags,
  breed_id,
  theme_id,
  style_id,
  format_id,
  coat_id,
  ai_model,
  generation_parameters,
  rating,
  is_featured,
  is_public,
  share_count,
  last_shared_at,
  like_count,
  view_count,
  last_liked_at,
  last_viewed_at,
  cloudinary_public_id,
  cloudinary_version,
  cloudinary_signature,
  image_variants,
  access_level,
  migration_status,
  migrated_at,
  created_by_customer_id,
  is_customer_generated,
  original_created_at,
  original_updated_at
FROM public.image_catalog_archive
WHERE archived_at >= (
  SELECT started_at FROM public.archive_operations WHERE id = '${operationId}'
)
ON CONFLICT (id) DO NOTHING;

-- Restore interaction_analytics
INSERT INTO public.interaction_analytics (
  id,
  image_id,
  total_likes,
  total_unlikes,
  net_likes,
  total_shares,
  total_views,
  unique_users,
  unique_likers,
  unique_sharers,
  unique_viewers,
  first_interaction_at,
  last_interaction_at,
  updated_at
)
SELECT
  original_id,
  (SELECT original_id FROM public.image_catalog_archive WHERE id = archived_image_id),
  total_likes,
  total_unlikes,
  net_likes,
  total_shares,
  total_views,
  unique_users,
  unique_likers,
  unique_sharers,
  unique_viewers,
  first_interaction_at,
  last_interaction_at,
  original_updated_at
FROM public.interaction_analytics_archive
WHERE archived_at >= (
  SELECT started_at FROM public.archive_operations WHERE id = '${operationId}'
)
ON CONFLICT (id) DO NOTHING;

-- Restore user_interactions
INSERT INTO public.user_interactions (
  id,
  image_id,
  user_id,
  session_id,
  interaction_type,
  platform,
  user_agent,
  ip_address,
  referrer,
  metadata,
  created_at
)
SELECT
  original_id,
  (SELECT original_id FROM public.image_catalog_archive WHERE id = archived_image_id),
  user_id,
  session_id,
  interaction_type,
  platform,
  user_agent,
  ip_address,
  referrer,
  metadata,
  original_created_at
FROM public.user_interactions_archive
WHERE archived_at >= (
  SELECT started_at FROM public.archive_operations WHERE id = '${operationId}'
)
ON CONFLICT (id) DO NOTHING;

-- Update archive operation status
UPDATE public.archive_operations
SET status = 'rolled_back',
    metadata = metadata || jsonb_build_object('rolled_back_at', NOW())
WHERE id = '${operationId}';

COMMIT;

-- Verification queries
SELECT 'Restored images:' as info, COUNT(*) as count FROM public.image_catalog WHERE id IN (
  SELECT original_id FROM public.image_catalog_archive WHERE archived_at >= (
    SELECT started_at FROM public.archive_operations WHERE id = '${operationId}'
  )
);
`;

  // Ensure rollback directory exists
  const rollbackDir = path.join(__dirname, '../db/rollback');
  if (!fs.existsSync(rollbackDir)) {
    fs.mkdirSync(rollbackDir, { recursive: true });
  }

  // Write rollback script
  fs.writeFileSync(scriptPath, rollbackSQL);
  console.log(`\n📄 Rollback script generated: ${scriptPath}`);

  return scriptPath;
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting catalog archive process...\n');
  console.log('====================================');
  console.log('⚠️  CRITICAL: This will archive ALL admin-generated catalog images');
  console.log('====================================\n');

  try {
    // Create operation record
    const operationId = await createArchiveOperation();
    stats.operationId = operationId;

    // Get image count
    stats.imagesTotal = await getImageCount();

    if (stats.imagesTotal === 0) {
      console.log('\n✅ No images to archive. Exiting.');
      await updateArchiveOperation(operationId, 'completed');
      process.exit(0);
    }

    // Archive images
    stats.imagesArchived = await archiveImageCatalog(operationId);

    // Archive analytics
    stats.analyticsArchived = await archiveInteractionAnalytics();

    // Archive interactions
    stats.interactionsArchived = await archiveUserInteractions();

    // Generate rollback script
    const rollbackPath = generateRollbackScript(operationId);

    // Update operation with rollback script path
    await supabase
      .from('archive_operations')
      .update({
        rollback_script_path: rollbackPath,
        rollback_deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() // 90 days
      })
      .eq('id', operationId);

    // Final stats
    stats.endTime = new Date();
    await updateArchiveOperation(operationId, 'completed');

    // Print summary
    console.log('\n====================================');
    console.log('✅ ARCHIVE COMPLETED SUCCESSFULLY');
    console.log('====================================\n');
    console.log(`📊 Summary:`);
    console.log(`   Images archived: ${stats.imagesArchived}/${stats.imagesTotal}`);
    console.log(`   Analytics archived: ${stats.analyticsArchived}`);
    console.log(`   Interactions archived: ${stats.interactionsArchived}`);
    console.log(`   Duration: ${((stats.endTime.getTime() - stats.startTime.getTime()) / 1000).toFixed(2)}s`);
    console.log(`   Errors: ${stats.errors.length}`);
    if (stats.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered:`);
      stats.errors.forEach(err => console.log(`   - ${err}`));
    }
    console.log(`\n📁 Rollback script: ${rollbackPath}`);
    console.log(`🔒 Archive retention: 90 days`);
    console.log(`🆔 Operation ID: ${operationId}\n`);

    console.log('✅ Next steps:');
    console.log('   1. Run verification script: tsx scripts/verify-archive-integrity.ts');
    console.log('   2. If verification passes, proceed with catalog deletion');
    console.log('   3. Keep rollback script for 90 days\n');

  } catch (error: any) {
    console.error('\n❌ ARCHIVE FAILED:', error.message);
    stats.endTime = new Date();
    stats.errors.push(error.message);

    if (stats.operationId) {
      await updateArchiveOperation(stats.operationId, 'failed');
    }

    process.exit(1);
  }
}

// Run main function
main().catch(console.error);
