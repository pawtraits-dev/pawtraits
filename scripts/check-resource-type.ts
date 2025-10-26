// Check Cloudinary resource type to diagnose ?_a= parameter issue
import { v2 as cloudinary } from 'cloudinary';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const publicId = 'pawtraits/customer-variations/batch-1761480789065-j0re00sw3';

async function checkResourceType() {
  console.log(`🔍 Checking resource type for: ${publicId}\n`);

  // Try as authenticated type first
  try {
    const authResult = await cloudinary.api.resource(publicId, {
      type: 'authenticated',
      resource_type: 'image'
    });
    console.log('❌ FOUND AS AUTHENTICATED RESOURCE (this is the problem!)\n');
    console.log('Resource Details:');
    console.log(`  - Type: ${authResult.type}`);
    console.log(`  - Resource Type: ${authResult.resource_type}`);
    console.log(`  - Secure URL: ${authResult.secure_url}`);
    console.log(`  - Width: ${authResult.width}`);
    console.log(`  - Height: ${authResult.height}`);
    console.log(`  - Format: ${authResult.format}`);
    console.log(`  - Created: ${authResult.created_at}`);
    console.log('\n⚠️  DIAGNOSIS: Image was uploaded as authenticated type');
    console.log('   Cloudinary automatically adds ?_a= parameter to authenticated resources');
    console.log('   Even when we specify type: "upload" in URL generation, it ignores it');
    console.log('   because the resource itself is authenticated.\n');
    return 'authenticated';
  } catch (authError: any) {
    if (authError.error?.http_code !== 404) {
      console.log(`Note: Error checking authenticated type: ${authError.message}`);
    }
  }

  // Try as upload (public) type
  try {
    const uploadResult = await cloudinary.api.resource(publicId, {
      type: 'upload',
      resource_type: 'image'
    });
    console.log('✅ FOUND AS UPLOAD (PUBLIC) RESOURCE\n');
    console.log('Resource Details:');
    console.log(`  - Type: ${uploadResult.type}`);
    console.log(`  - Resource Type: ${uploadResult.resource_type}`);
    console.log(`  - Secure URL: ${uploadResult.secure_url}`);
    console.log(`  - Width: ${uploadResult.width}`);
    console.log(`  - Height: ${uploadResult.height}`);
    console.log(`  - Format: ${uploadResult.format}`);
    console.log(`  - Created: ${uploadResult.created_at}`);
    console.log('\n✅ This image is public - should not have ?_a= parameter');

    // Test URL generation
    console.log('\n📋 Testing URL Generation:');
    const testUrl = cloudinary.url(publicId, {
      type: 'upload',
      resource_type: 'image',
      sign_url: false,
      secure: true,
      quality: 100,
      format: 'png'
    });
    console.log(`Generated URL: ${testUrl}`);
    console.log(`Has ?_a= parameter: ${testUrl.includes('?_a=') ? '❌ YES (unexpected!)' : '✅ NO (correct)'}`);
    return 'upload';
  } catch (uploadError: any) {
    console.log(`❌ Not found as upload: ${uploadError.message}`);
  }

  console.log('❌ Resource not found in either authenticated or upload types');
  return 'not_found';
}

checkResourceType().catch(console.error);
