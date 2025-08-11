#!/usr/bin/env npx tsx

/**
 * Migrate existing images from Supabase Storage to Cloudinary
 * Usage: npm run migrate-cloudinary
 */

// Load environment variables first
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { cloudinaryService } from '../lib/cloudinary';
import * as fs from 'fs';
import * as path from 'path';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface MigrationStats {
  totalImages: number;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: Array<{
    imageId: string;
    filename: string;
    error: string;
  }>;
}

interface ImageRecord {
  id: string;
  filename: string;
  storage_path: string;
  breed_name: string;
  theme_name: string;
  style_name: string;
  cloudinary_public_id: string | null;
  migration_status: string;
}

async function migrateImagesToCloudinary(
  batchSize: number = 5,
  skipExisting: boolean = true,
  dryRun: boolean = false
) {
  console.log('🚀 Starting Cloudinary Migration');
  console.log('================================\n');
  
  const stats: MigrationStats = {
    totalImages: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    errors: []
  };

  try {
    // Test Cloudinary connection first
    console.log('🔧 Testing Cloudinary connection...');
    const connectionOk = await cloudinaryService.testConnection();
    if (!connectionOk) {
      throw new Error('Cloudinary connection failed');
    }
    console.log('✅ Cloudinary connection successful\n');

    // Get images to migrate
    console.log(`📦 Fetching images to migrate (batch size: ${batchSize})...`);
    
    let query = supabase
      .from('image_catalog_with_details')
      .select(`
        id,
        filename,
        storage_path,
        breed_name,
        theme_name,
        style_name,
        cloudinary_public_id,
        migration_status
      `)
      .limit(batchSize);

    if (skipExisting) {
      query = query.or('cloudinary_public_id.is.null,migration_status.eq.failed');
    }

    const { data: images, error } = await query;

    if (error) {
      console.error('❌ Error fetching images:', error);
      return;
    }

    if (!images || images.length === 0) {
      console.log('🎉 No images to migrate! All images are already processed.');
      return;
    }

    stats.totalImages = images.length;
    console.log(`📊 Found ${images.length} images to migrate\n`);

    if (dryRun) {
      console.log('🧪 DRY RUN MODE - No actual migration will occur\n');
      images.forEach((image, index) => {
        console.log(`${index + 1}. ${image.filename} (${image.breed_name}/${image.theme_name})`);
      });
      console.log('\n✅ Dry run complete. Run without --dry-run to execute migration.');
      return;
    }

    // Process each image
    for (let i = 0; i < images.length; i++) {
      const image = images[i] as ImageRecord;
      stats.processed++;
      
      console.log(`\n🔄 Processing ${stats.processed}/${stats.totalImages}: ${image.filename}`);
      console.log(`   Breed: ${image.breed_name}, Theme: ${image.theme_name}, Style: ${image.style_name}`);

      try {
        // Update status to 'migrating'
        await updateMigrationStatus(image.id, 'migrating');

        // Check if already migrated
        if (skipExisting && image.cloudinary_public_id && image.migration_status === 'completed') {
          console.log('⏭️  Already migrated, skipping...');
          stats.skipped++;
          continue;
        }

        // Download from Supabase storage
        console.log('   📥 Downloading from Supabase...');
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('pet-images')
          .download(image.storage_path);

        if (downloadError || !fileData) {
          throw new Error(`Download failed: ${downloadError?.message || 'No file data'}`);
        }

        // Convert to buffer
        const buffer = Buffer.from(await fileData.arrayBuffer());
        console.log(`   📦 Downloaded ${buffer.length} bytes`);

        // Upload to Cloudinary and generate variants
        console.log('   ☁️  Uploading to Cloudinary...');
        const result = await cloudinaryService.uploadAndProcessImage(
          buffer,
          image.filename,
          {
            breed: image.breed_name || 'unknown',
            theme: image.theme_name || 'unknown',
            style: image.style_name || 'unknown',
            imageId: image.id
          }
        );

        console.log(`   🎨 Generated ${Object.keys(result.variants).length} variants`);

        // Update database record
        console.log('   💾 Updating database...');
        const { error: updateError } = await supabase
          .from('image_catalog')
          .update({
            cloudinary_public_id: result.public_id,
            cloudinary_version: result.version,
            cloudinary_signature: result.cloudinary_signature,
            image_variants: result.variants,
            migration_status: 'completed',
            migrated_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', image.id);

        if (updateError) {
          throw new Error(`Database update failed: ${updateError.message}`);
        }

        console.log('   ✅ Migration successful!');
        stats.successful++;

        // Brief pause to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`   ❌ Migration failed: ${errorMsg}`);
        
        // Update status to 'failed'
        await updateMigrationStatus(image.id, 'failed');
        
        stats.failed++;
        stats.errors.push({
          imageId: image.id,
          filename: image.filename,
          error: errorMsg
        });
      }
    }

    // Print final statistics
    console.log('\n📊 Migration Complete!');
    console.log('=====================');
    console.log(`Total images: ${stats.totalImages}`);
    console.log(`Processed: ${stats.processed}`);
    console.log(`✅ Successful: ${stats.successful}`);
    console.log(`⏭️  Skipped: ${stats.skipped}`);
    console.log(`❌ Failed: ${stats.failed}`);

    if (stats.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      stats.errors.forEach((err, index) => {
        console.log(`${index + 1}. ${err.filename}: ${err.error}`);
      });
    }

    // Save migration log
    const logData = {
      timestamp: new Date().toISOString(),
      stats,
      errors: stats.errors
    };

    const logPath = path.join(process.cwd(), 'migration-log.json');
    fs.writeFileSync(logPath, JSON.stringify(logData, null, 2));
    console.log(`\n📝 Migration log saved to: ${logPath}`);

    if (stats.failed > 0) {
      console.log('\n💡 To retry failed migrations, run this script again with skipExisting=true');
    }

    if (stats.successful > 0) {
      console.log('\n🎉 Migration batch completed successfully!');
      console.log('💡 Run the script again to process more images if needed.');
    }

  } catch (error) {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  }
}

async function updateMigrationStatus(imageId: string, status: string) {
  try {
    await supabase
      .from('image_catalog')
      .update({
        migration_status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', imageId);
  } catch (error) {
    console.warn(`⚠️ Failed to update migration status for ${imageId}:`, error);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const batchSize = parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '5');
const skipExisting = !args.includes('--no-skip');
const dryRun = args.includes('--dry-run');

console.log('⚙️ Migration Configuration:');
console.log(`   Batch size: ${batchSize}`);
console.log(`   Skip existing: ${skipExisting}`);
console.log(`   Dry run: ${dryRun}`);
console.log('');

// Run the migration
migrateImagesToCloudinary(batchSize, skipExisting, dryRun)
  .catch(console.error);