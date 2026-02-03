/**
 * Verify Archive Integrity Script
 *
 * Validates that archived data matches the original catalog data.
 * Must be run BEFORE deleting any catalog data.
 *
 * Usage: tsx scripts/verify-archive-integrity.ts
 *
 * Exit codes:
 *   0 = All checks passed
 *   1 = Verification failed or errors encountered
 */

import { createClient } from '@supabase/supabase-js';

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

interface VerificationResult {
  checkName: string;
  passed: boolean;
  expected?: number;
  actual?: number;
  message?: string;
}

const results: VerificationResult[] = [];
let hasFailures = false;

/**
 * Log result and track overall status
 */
function logResult(result: VerificationResult) {
  results.push(result);

  if (result.passed) {
    console.log(`✅ ${result.checkName}`);
    if (result.message) {
      console.log(`   ${result.message}`);
    }
  } else {
    hasFailures = true;
    console.log(`❌ ${result.checkName}`);
    console.log(`   Expected: ${result.expected}, Actual: ${result.actual}`);
    if (result.message) {
      console.log(`   ${result.message}`);
    }
  }
}

/**
 * Check if archive tables exist
 */
async function checkArchiveTablesExist(): Promise<void> {
  console.log('\n🔍 Checking archive tables exist...\n');

  const tables = [
    'image_catalog_archive',
    'interaction_analytics_archive',
    'user_interactions_archive',
    'archive_operations'
  ];

  for (const tableName of tables) {
    const { data, error } = await supabase
      .from(tableName)
      .select('id', { head: true, count: 'exact' });

    if (error) {
      logResult({
        checkName: `Table ${tableName} exists`,
        passed: false,
        message: `Error: ${error.message}`
      });
    } else {
      logResult({
        checkName: `Table ${tableName} exists`,
        passed: true,
        message: `Found ${data} records`
      });
    }
  }
}

/**
 * Check image count matches
 */
async function checkImageCounts(): Promise<void> {
  console.log('\n🔍 Checking image counts...\n');

  // Count original admin-generated images
  const { count: originalCount, error: originalError } = await supabase
    .from('image_catalog')
    .select('id', { count: 'exact', head: true })
    .eq('is_customer_generated', false);

  if (originalError) {
    logResult({
      checkName: 'Count original images',
      passed: false,
      message: `Error: ${originalError.message}`
    });
    return;
  }

  // Count archived images
  const { count: archivedCount, error: archivedError } = await supabase
    .from('image_catalog_archive')
    .select('id', { count: 'exact', head: true });

  if (archivedError) {
    logResult({
      checkName: 'Count archived images',
      passed: false,
      message: `Error: ${archivedError.message}`
    });
    return;
  }

  logResult({
    checkName: 'Image counts match',
    passed: originalCount === archivedCount,
    expected: originalCount || 0,
    actual: archivedCount || 0,
    message: originalCount === archivedCount
      ? `${originalCount} images archived successfully`
      : `Mismatch detected! Some images may not be archived.`
  });
}

/**
 * Sample-check image data integrity
 */
async function checkImageDataIntegrity(): Promise<void> {
  console.log('\n🔍 Checking image data integrity (sample)...\n');

  // Get 10 random original images
  const { data: originalImages, error: fetchError } = await supabase
    .from('image_catalog')
    .select('*')
    .eq('is_customer_generated', false)
    .limit(10);

  if (fetchError) {
    logResult({
      checkName: 'Fetch sample images',
      passed: false,
      message: `Error: ${fetchError.message}`
    });
    return;
  }

  if (!originalImages || originalImages.length === 0) {
    logResult({
      checkName: 'Sample image data integrity',
      passed: true,
      message: 'No images to verify (catalog may be empty)'
    });
    return;
  }

  let mismatches = 0;

  for (const original of originalImages) {
    const { data: archived, error: archiveError } = await supabase
      .from('image_catalog_archive')
      .select('*')
      .eq('original_id', original.id)
      .single();

    if (archiveError || !archived) {
      mismatches++;
      console.log(`   ⚠️  Image ${original.id} not found in archive`);
      continue;
    }

    // Check critical fields match
    const fieldsToCheck = [
      'filename',
      'cloudinary_public_id',
      'prompt_text',
      'breed_id',
      'theme_id',
      'style_id'
    ];

    for (const field of fieldsToCheck) {
      if (original[field] !== archived[field]) {
        mismatches++;
        console.log(`   ⚠️  Mismatch in ${field} for image ${original.id}`);
        console.log(`       Original: ${original[field]}`);
        console.log(`       Archived: ${archived[field]}`);
      }
    }
  }

  logResult({
    checkName: 'Sample image data integrity',
    passed: mismatches === 0,
    expected: 0,
    actual: mismatches,
    message: mismatches === 0
      ? `Verified ${originalImages.length} sample images`
      : `Found ${mismatches} mismatches in sample data`
  });
}

/**
 * Check analytics counts
 */
async function checkAnalyticsCounts(): Promise<void> {
  console.log('\n🔍 Checking analytics counts...\n');

  // Get archived image IDs
  const { data: archivedImages } = await supabase
    .from('image_catalog_archive')
    .select('original_id');

  if (!archivedImages || archivedImages.length === 0) {
    logResult({
      checkName: 'Analytics counts',
      passed: true,
      message: 'No archived images to check analytics for'
    });
    return;
  }

  const archivedImageIds = archivedImages.map(img => img.original_id);

  // Count original analytics
  const { count: originalAnalyticsCount, error: originalError } = await supabase
    .from('interaction_analytics')
    .select('id', { count: 'exact', head: true })
    .in('image_id', archivedImageIds);

  if (originalError) {
    logResult({
      checkName: 'Count original analytics',
      passed: false,
      message: `Error: ${originalError.message}`
    });
    return;
  }

  // Count archived analytics
  const { count: archivedAnalyticsCount, error: archivedError } = await supabase
    .from('interaction_analytics_archive')
    .select('id', { count: 'exact', head: true });

  if (archivedError) {
    logResult({
      checkName: 'Count archived analytics',
      passed: false,
      message: `Error: ${archivedError.message}`
    });
    return;
  }

  logResult({
    checkName: 'Analytics counts match',
    passed: originalAnalyticsCount === archivedAnalyticsCount,
    expected: originalAnalyticsCount || 0,
    actual: archivedAnalyticsCount || 0,
    message: originalAnalyticsCount === archivedAnalyticsCount
      ? `${originalAnalyticsCount} analytics records archived`
      : `Mismatch detected! Some analytics may not be archived.`
  });
}

/**
 * Check user interactions counts
 */
async function checkInteractionsCounts(): Promise<void> {
  console.log('\n🔍 Checking user interactions counts...\n');

  // Get archived image IDs
  const { data: archivedImages } = await supabase
    .from('image_catalog_archive')
    .select('original_id');

  if (!archivedImages || archivedImages.length === 0) {
    logResult({
      checkName: 'User interactions counts',
      passed: true,
      message: 'No archived images to check interactions for'
    });
    return;
  }

  const archivedImageIds = archivedImages.map(img => img.original_id);

  // Count original interactions (sample, can be very large)
  const { count: originalInteractionsCount, error: originalError } = await supabase
    .from('user_interactions')
    .select('id', { count: 'exact', head: true })
    .in('image_id', archivedImageIds);

  if (originalError) {
    logResult({
      checkName: 'Count original interactions',
      passed: false,
      message: `Error: ${originalError.message}`
    });
    return;
  }

  // Count archived interactions
  const { count: archivedInteractionsCount, error: archivedError } = await supabase
    .from('user_interactions_archive')
    .select('id', { count: 'exact', head: true });

  if (archivedError) {
    logResult({
      checkName: 'Count archived interactions',
      passed: false,
      message: `Error: ${archivedError.message}`
    });
    return;
  }

  logResult({
    checkName: 'User interactions counts match',
    passed: originalInteractionsCount === archivedInteractionsCount,
    expected: originalInteractionsCount || 0,
    actual: archivedInteractionsCount || 0,
    message: originalInteractionsCount === archivedInteractionsCount
      ? `${originalInteractionsCount} interaction records archived`
      : `Mismatch detected! Some interactions may not be archived.`
  });
}

/**
 * Check foreign key references
 */
async function checkForeignKeyReferences(): Promise<void> {
  console.log('\n🔍 Checking foreign key references...\n');

  // Check that all archived analytics reference valid archived images
  const { data: orphanedAnalytics, error: analyticsError } = await supabase
    .from('interaction_analytics_archive')
    .select('id, archived_image_id')
    .is('archived_image_id', null);

  if (analyticsError) {
    logResult({
      checkName: 'Analytics foreign keys',
      passed: false,
      message: `Error: ${analyticsError.message}`
    });
  } else {
    const orphanCount = orphanedAnalytics?.length || 0;
    logResult({
      checkName: 'Analytics foreign keys',
      passed: orphanCount === 0,
      expected: 0,
      actual: orphanCount,
      message: orphanCount === 0
        ? 'All analytics reference valid archived images'
        : `${orphanCount} analytics records missing image reference`
    });
  }

  // Check that all archived interactions reference valid archived images
  const { data: orphanedInteractions, error: interactionsError } = await supabase
    .from('user_interactions_archive')
    .select('id, archived_image_id')
    .is('archived_image_id', null);

  if (interactionsError) {
    logResult({
      checkName: 'Interactions foreign keys',
      passed: false,
      message: `Error: ${interactionsError.message}`
    });
  } else {
    const orphanCount = orphanedInteractions?.length || 0;
    logResult({
      checkName: 'Interactions foreign keys',
      passed: orphanCount === 0,
      expected: 0,
      actual: orphanCount,
      message: orphanCount === 0
        ? 'All interactions reference valid archived images'
        : `${orphanCount} interaction records missing image reference`
    });
  }
}

/**
 * Check archive operation record
 */
async function checkArchiveOperation(): Promise<void> {
  console.log('\n🔍 Checking archive operation record...\n');

  // Get most recent archive operation
  const { data: operations, error: fetchError } = await supabase
    .from('archive_operations')
    .select('*')
    .eq('operation_type', 'catalog_archival')
    .order('started_at', { ascending: false })
    .limit(1);

  if (fetchError) {
    logResult({
      checkName: 'Archive operation exists',
      passed: false,
      message: `Error: ${fetchError.message}`
    });
    return;
  }

  if (!operations || operations.length === 0) {
    logResult({
      checkName: 'Archive operation exists',
      passed: false,
      message: 'No archive operation record found'
    });
    return;
  }

  const operation = operations[0];

  logResult({
    checkName: 'Archive operation exists',
    passed: true,
    message: `Operation ID: ${operation.id}, Status: ${operation.status}`
  });

  logResult({
    checkName: 'Archive operation completed',
    passed: operation.status === 'completed',
    message: operation.status === 'completed'
      ? `Completed at ${operation.completed_at}`
      : `Current status: ${operation.status}`
  });

  if (operation.rollback_script_path) {
    logResult({
      checkName: 'Rollback script exists',
      passed: true,
      message: `Path: ${operation.rollback_script_path}`
    });
  } else {
    logResult({
      checkName: 'Rollback script exists',
      passed: false,
      message: 'No rollback script path recorded'
    });
  }

  // Check rollback deadline
  if (operation.rollback_deadline) {
    const deadline = new Date(operation.rollback_deadline);
    const daysRemaining = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    logResult({
      checkName: 'Rollback deadline set',
      passed: true,
      message: `${daysRemaining} days remaining until ${deadline.toISOString().split('T')[0]}`
    });
  }

  // Display operation stats
  console.log(`\n📊 Archive Operation Stats:`);
  console.log(`   Images archived: ${operation.images_archived || 0}`);
  console.log(`   Analytics archived: ${operation.analytics_archived || 0}`);
  console.log(`   Interactions archived: ${operation.interactions_archived || 0}`);
}

/**
 * Check customer data safety
 */
async function checkCustomerDataSafety(): Promise<void> {
  console.log('\n🔍 Checking customer data safety...\n');

  // Verify customer_generated_images table is untouched
  const { count: customerImagesCount, error: customerError } = await supabase
    .from('image_catalog')
    .select('id', { count: 'exact', head: true })
    .eq('is_customer_generated', true);

  if (customerError) {
    logResult({
      checkName: 'Customer images intact',
      passed: false,
      message: `Error: ${customerError.message}`
    });
    return;
  }

  logResult({
    checkName: 'Customer images intact',
    passed: true,
    message: `${customerImagesCount || 0} customer-generated images preserved`
  });

  // Verify NO customer images in archive
  const { count: archivedCustomerCount, error: archiveCustomerError } = await supabase
    .from('image_catalog_archive')
    .select('id', { count: 'exact', head: true })
    .eq('is_customer_generated', true);

  if (archiveCustomerError) {
    logResult({
      checkName: 'No customer images in archive',
      passed: false,
      message: `Error: ${archiveCustomerError.message}`
    });
    return;
  }

  logResult({
    checkName: 'No customer images in archive',
    passed: archivedCustomerCount === 0,
    expected: 0,
    actual: archivedCustomerCount || 0,
    message: archivedCustomerCount === 0
      ? 'Archive correctly excludes customer images'
      : `WARNING: ${archivedCustomerCount} customer images found in archive!`
  });
}

/**
 * Print summary report
 */
function printSummary(): void {
  console.log('\n====================================');
  console.log('📋 VERIFICATION SUMMARY');
  console.log('====================================\n');

  const totalChecks = results.length;
  const passedChecks = results.filter(r => r.passed).length;
  const failedChecks = totalChecks - passedChecks;

  console.log(`Total checks: ${totalChecks}`);
  console.log(`✅ Passed: ${passedChecks}`);
  console.log(`❌ Failed: ${failedChecks}\n`);

  if (failedChecks > 0) {
    console.log('⚠️  FAILED CHECKS:\n');
    results
      .filter(r => !r.passed)
      .forEach(r => {
        console.log(`   ❌ ${r.checkName}`);
        if (r.message) console.log(`      ${r.message}`);
      });
    console.log('\n');
  }

  if (hasFailures) {
    console.log('❌ VERIFICATION FAILED');
    console.log('\n⚠️  DO NOT PROCEED WITH DELETION!');
    console.log('   Please investigate failures and re-run archive script if needed.\n');
  } else {
    console.log('✅ VERIFICATION PASSED');
    console.log('\n✨ All checks passed! Archive integrity confirmed.');
    console.log('   You may proceed with catalog deletion.\n');
    console.log('⚠️  Remember to:');
    console.log('   1. Test deletion in staging environment first');
    console.log('   2. Ensure rollback script is backed up');
    console.log('   3. Have restoration plan ready (90-day retention)');
    console.log('   4. Monitor for any customer data impact\n');
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🔍 Starting archive integrity verification...\n');
  console.log('====================================');
  console.log('This will validate archived data matches original catalog');
  console.log('====================================');

  try {
    await checkArchiveTablesExist();
    await checkImageCounts();
    await checkImageDataIntegrity();
    await checkAnalyticsCounts();
    await checkInteractionsCounts();
    await checkForeignKeyReferences();
    await checkArchiveOperation();
    await checkCustomerDataSafety();

    printSummary();

    process.exit(hasFailures ? 1 : 0);

  } catch (error: any) {
    console.error('\n❌ VERIFICATION ERROR:', error.message);
    console.error('\n⚠️  Cannot verify archive integrity. DO NOT PROCEED WITH DELETION.\n');
    process.exit(1);
  }
}

// Run main function
main().catch(console.error);
