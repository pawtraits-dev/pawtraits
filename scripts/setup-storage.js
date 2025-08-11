/**
 * Script to set up Supabase storage buckets for pet photos
 * Run with: node scripts/setup-storage.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing required environment variables:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setupStorage() {
  console.log('Setting up Supabase storage buckets...');

  try {
    // Create the pet-photos bucket
    console.log('Creating pet-photos bucket...');
    const { data: bucket, error: bucketError } = await supabase.storage.createBucket('pet-photos', {
      public: true,
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
      fileSizeLimit: 10485760 // 10MB
    });

    if (bucketError) {
      if (bucketError.message.includes('already exists')) {
        console.log('✓ pet-photos bucket already exists');
      } else {
        console.error('Error creating bucket:', bucketError);
        return;
      }
    } else {
      console.log('✓ pet-photos bucket created successfully');
    }

    // Set up bucket policies
    console.log('Setting up storage policies...');
    
    // Policy for authenticated users to upload photos
    const uploadPolicy = {
      name: 'pet_photos_upload_policy',
      definition: `
        ((bucket_id = 'pet-photos'::text) AND (auth.role() = 'authenticated'::text))
      `,
      check: `
        ((bucket_id = 'pet-photos'::text) AND (auth.role() = 'authenticated'::text))
      `
    };

    // Policy for public read access
    const readPolicy = {
      name: 'pet_photos_read_policy', 
      definition: `
        (bucket_id = 'pet-photos'::text)
      `,
      check: `
        (bucket_id = 'pet-photos'::text)
      `
    };

    // Note: Storage policies need to be set up via Supabase Dashboard or SQL
    console.log('✓ Storage bucket setup complete');
    console.log('');
    console.log('⚠️  IMPORTANT: You need to set up the following storage policies in your Supabase Dashboard:');
    console.log('');
    console.log('1. Go to Storage > Policies in your Supabase Dashboard');
    console.log('2. Create a policy for INSERT on storage.objects:');
    console.log('   - Name: "Allow authenticated users to upload pet photos"');
    console.log('   - Operation: INSERT');
    console.log('   - Target roles: authenticated');
    console.log('   - Policy definition: bucket_id = \'pet-photos\'');
    console.log('');
    console.log('3. Create a policy for SELECT on storage.objects:');
    console.log('   - Name: "Allow public read access to pet photos"'); 
    console.log('   - Operation: SELECT');
    console.log('   - Target roles: public, authenticated');
    console.log('   - Policy definition: bucket_id = \'pet-photos\'');
    console.log('');
    console.log('4. Create a policy for DELETE on storage.objects (optional):');
    console.log('   - Name: "Allow users to delete their own pet photos"');
    console.log('   - Operation: DELETE');
    console.log('   - Target roles: authenticated');
    console.log('   - Policy definition: (bucket_id = \'pet-photos\') AND (auth.uid()::text = (storage.foldername(name))[1])');

  } catch (error) {
    console.error('Error setting up storage:', error);
  }
}

setupStorage();