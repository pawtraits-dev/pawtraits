#!/usr/bin/env npx tsx

/**
 * Check storage structure to understand where generated images are stored
 */

// Load environment variables first
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkStorageStructure() {
  console.log('🔍 Investigating Storage Structure');
  console.log('==================================\n');

  // Get sample image records to see storage paths
  console.log('📄 Sample image records:');
  const { data: images, error } = await supabase
    .from('image_catalog')
    .select('id, filename, storage_path')
    .limit(3);

  if (error) {
    console.error('❌ Error fetching images:', error);
    return;
  }

  if (!images || images.length === 0) {
    console.log('No images found in database');
    return;
  }

  for (const image of images) {
    console.log(`\n🖼️ Image: ${image.filename}`);
    console.log(`   ID: ${image.id}`);
    console.log(`   Storage path: ${image.storage_path}`);
  }

  // List all storage buckets
  console.log('\n🗂️ Available storage buckets:');
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
  
  if (bucketsError) {
    console.error('❌ Error listing buckets:', bucketsError);
    return;
  }

  if (buckets) {
    for (const bucket of buckets) {
      console.log(`   📁 ${bucket.name} (${bucket.public ? 'public' : 'private'})`);
      
      // List contents of each bucket (just top level)
      const { data: files, error: filesError } = await supabase.storage
        .from(bucket.name)
        .list('', { limit: 5 });
        
      if (!filesError && files) {
        files.forEach(file => {
          console.log(`      📄 ${file.name} (${file.metadata?.size || 'unknown size'})`);
        });
      }
    }
  }

  // Try to download one of the sample images to test
  if (images.length > 0) {
    const testImage = images[0];
    console.log(`\n🧪 Testing download of: ${testImage.filename}`);
    
    // Try different bucket names
    const bucketsToTry = ['pet-images', 'generated-images', 'portraits', 'images'];
    
    for (const bucketName of bucketsToTry) {
      console.log(`   Testing bucket: ${bucketName}`);
      const { data, error } = await supabase.storage
        .from(bucketName)
        .download(testImage.storage_path);
        
      if (!error && data) {
        console.log(`   ✅ Found in ${bucketName} bucket! Size: ${data.size} bytes`);
        break;
      } else {
        console.log(`   ❌ Not found in ${bucketName}: ${error?.message || 'No data'}`);
      }
    }
  }
}

// Run the check
checkStorageStructure().catch(console.error);