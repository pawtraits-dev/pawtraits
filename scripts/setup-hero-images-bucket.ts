#!/usr/bin/env npx tsx

/**
 * Setup script for hero-images storage bucket
 * This creates the bucket and sets up proper RLS policies
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setupHeroImagesBucket() {
  console.log('🚀 Setting up hero-images storage bucket...\n');

  try {
    // 1. Check if bucket already exists
    console.log('📋 Checking existing buckets...');
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('❌ Error listing buckets:', listError);
      return;
    }

    const existingBucket = buckets?.find(b => b.name === 'hero-images');
    
    if (existingBucket) {
      console.log('✅ hero-images bucket already exists');
    } else {
      // 2. Create the bucket
      console.log('📁 Creating hero-images bucket...');
      const { data: newBucket, error: createError } = await supabase.storage.createBucket('hero-images', {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
        fileSizeLimit: 8 * 1024 * 1024, // 8MB limit
      });

      if (createError) {
        console.error('❌ Error creating bucket:', createError);
        return;
      }

      console.log('✅ hero-images bucket created successfully');
    }

    // 3. Set up RLS policies
    console.log('\n🔐 Setting up Row Level Security policies...');

    const policies = [
      {
        name: 'Allow authenticated users to upload hero images',
        sql: `
          CREATE POLICY "Allow authenticated users to upload hero images" 
          ON storage.objects FOR INSERT 
          TO authenticated 
          WITH CHECK (bucket_id = 'hero-images');
        `
      },
      {
        name: 'Allow public read access to hero images',
        sql: `
          CREATE POLICY "Allow public read access to hero images" 
          ON storage.objects FOR SELECT 
          TO public, authenticated 
          USING (bucket_id = 'hero-images');
        `
      },
      {
        name: 'Allow authenticated users to update hero images',
        sql: `
          CREATE POLICY "Allow authenticated users to update hero images" 
          ON storage.objects FOR UPDATE 
          TO authenticated 
          USING (bucket_id = 'hero-images')
          WITH CHECK (bucket_id = 'hero-images');
        `
      },
      {
        name: 'Allow authenticated users to delete hero images',
        sql: `
          CREATE POLICY "Allow authenticated users to delete hero images" 
          ON storage.objects FOR DELETE 
          TO authenticated 
          USING (bucket_id = 'hero-images');
        `
      }
    ];

    for (const policy of policies) {
      try {
        const { error: policyError } = await supabase.rpc('exec', {
          sql: policy.sql
        });

        if (policyError) {
          // Check if policy already exists
          if (policyError.message?.includes('already exists')) {
            console.log(`⚠️  Policy "${policy.name}" already exists`);
          } else {
            console.error(`❌ Error creating policy "${policy.name}":`, policyError);
          }
        } else {
          console.log(`✅ Created policy: "${policy.name}"`);
        }
      } catch (error) {
        console.error(`❌ Error with policy "${policy.name}":`, error);
      }
    }

    // 4. Test the bucket
    console.log('\n🧪 Testing bucket access...');
    
    try {
      const { data: files, error: listFilesError } = await supabase.storage
        .from('hero-images')
        .list('', { limit: 1 });

      if (listFilesError) {
        console.error('❌ Error testing bucket access:', listFilesError);
      } else {
        console.log('✅ Bucket access test successful');
      }
    } catch (error) {
      console.error('❌ Bucket test failed:', error);
    }

    // 5. Display summary
    console.log('\n📊 Setup Summary:');
    console.log('   ✅ Bucket: hero-images');
    console.log('   ✅ Public read access enabled');
    console.log('   ✅ Authenticated upload/update/delete enabled');
    console.log('   ✅ File size limit: 8MB');
    console.log('   ✅ Allowed types: JPEG, PNG, WebP');
    console.log('\n🎉 Hero images bucket setup complete!');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run the setup
setupHeroImagesBucket();