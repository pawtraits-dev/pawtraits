/**
 * Regenerate print-quality URLs for existing images in catalog
 *
 * This script:
 * 1. Fetches all images with Cloudinary public IDs
 * 2. Checks each image's dimensions
 * 3. Regenerates the 'original' variant URL with smart upscaling
 * 4. Updates the image_variants JSONB field in database
 *
 * Run with: tsx scripts/regenerate-print-quality-urls.ts
 */

import { createClient } from '@supabase/supabase-js';
import { cloudinaryService } from '../lib/cloudinary';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

interface ImageRecord {
  id: string;
  cloudinary_public_id: string | null;
  image_variants: any;
  filename: string;
}

async function regeneratePrintUrls() {
  console.log('🚀 Starting print-quality URL regeneration...\n');

  try {
    // Fetch all images with Cloudinary public IDs
    const { data: images, error } = await supabase
      .from('image_catalog')
      .select('id, cloudinary_public_id, image_variants, filename')
      .not('cloudinary_public_id', 'is', null);

    if (error) {
      throw new Error(`Failed to fetch images: ${error.message}`);
    }

    if (!images || images.length === 0) {
      console.log('ℹ️  No images with Cloudinary public IDs found.');
      return;
    }

    console.log(`📊 Found ${images.length} images with Cloudinary public IDs\n`);

    let updatedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < images.length; i++) {
      const image = images[i] as ImageRecord;
      const progress = `[${i + 1}/${images.length}]`;

      console.log(`${progress} Processing: ${image.filename}`);
      console.log(`   ID: ${image.id}`);
      console.log(`   Public ID: ${image.cloudinary_public_id}`);

      if (!image.cloudinary_public_id) {
        console.log(`   ⏭️  Skipped: No Cloudinary public ID\n`);
        skippedCount++;
        continue;
      }

      try {
        // Generate new original print URL using smart upscaling logic
        const newOriginalUrl = await cloudinaryService.getOriginalPrintUrl(
          image.cloudinary_public_id,
          `regeneration-${image.id}`
        );

        // Get existing variants or create new object
        const existingVariants = image.image_variants || {};

        // Update the original variant URL
        const updatedVariants = {
          ...existingVariants,
          original: {
            ...existingVariants.original,
            url: newOriginalUrl,
            access_type: 'print_fulfillment_only',
            dpi: 300,
            overlay: 'none',
            description: 'For printing'
          }
        };

        // Update database
        const { error: updateError } = await supabase
          .from('image_catalog')
          .update({
            image_variants: updatedVariants,
            updated_at: new Date().toISOString()
          })
          .eq('id', image.id);

        if (updateError) {
          throw new Error(`Database update failed: ${updateError.message}`);
        }

        console.log(`   ✅ Updated with new print-quality URL`);
        console.log(`   📐 URL: ${newOriginalUrl.substring(0, 80)}...\n`);
        updatedCount++;

      } catch (error) {
        console.error(`   ❌ Error processing image:`, error);
        console.error(`      ${error instanceof Error ? error.message : String(error)}\n`);
        errorCount++;
      }

      // Add a small delay to avoid rate limiting
      if (i < images.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 REGENERATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total images processed: ${images.length}`);
    console.log(`✅ Successfully updated: ${updatedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log('='.repeat(60) + '\n');

    if (errorCount > 0) {
      console.log('⚠️  Some images failed to update. Review the errors above.');
      process.exit(1);
    }

    console.log('✅ All images successfully updated with print-quality URLs!');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    console.error(error instanceof Error ? error.stack : String(error));
    process.exit(1);
  }
}

// Run the script
console.log('🔧 Regenerate Print-Quality URLs for Image Catalog');
console.log('='.repeat(60) + '\n');

regeneratePrintUrls()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
