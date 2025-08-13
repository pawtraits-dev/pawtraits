import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import crypto from 'crypto';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function GET() {
  try {
    console.log('🔍 Testing Cloudinary Configuration and Signature Generation');
    
    // Step 1: Check environment variables
    const config = {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    };
    
    console.log('📋 Environment Check:');
    console.log(`   Cloud Name: ${config.cloud_name ? '✅ Present' : '❌ Missing'}`);
    console.log(`   API Key: ${config.api_key ? '✅ Present' : '❌ Missing'}`);
    console.log(`   API Secret: ${config.api_secret ? '✅ Present' : '❌ Missing'}`);
    
    if (!config.cloud_name || !config.api_key || !config.api_secret) {
      return NextResponse.json({
        error: 'Missing Cloudinary environment variables',
        config: {
          cloud_name: !!config.cloud_name,
          api_key: !!config.api_key,
          api_secret: !!config.api_secret
        }
      }, { status: 500 });
    }
    
    // Step 2: Test basic Cloudinary connection
    console.log('🔗 Testing Cloudinary Connection...');
    try {
      const pingResult = await cloudinary.api.ping();
      console.log(`   Connection: ✅ ${pingResult.status}`);
    } catch (pingError) {
      console.error(`   Connection: ❌ Failed - ${pingError}`);
      return NextResponse.json({
        error: 'Cloudinary connection failed',
        details: pingError instanceof Error ? pingError.message : 'Unknown error'
      }, { status: 500 });
    }
    
    // Step 3: Generate signature manually and compare with Cloudinary utils
    console.log('🔐 Testing Signature Generation...');
    
    const timestamp = Math.round(Date.now() / 1000);
    const folder = 'pawtraits/originals';
    
    // Parameters to sign (MUST match exactly what we send to Cloudinary)
    const uploadParams = {
      folder,
      timestamp
    };
    
    console.log(`   Parameters to sign:`, uploadParams);
    
    // Method 1: Manual signature generation
    const paramsString = Object.keys(uploadParams)
      .sort()
      .map(key => `${key}=${uploadParams[key]}`)
      .join('&');
    
    const manualSignature = crypto
      .createHash('sha1')
      .update(paramsString + config.api_secret)
      .digest('hex');
    
    console.log(`   String to sign: "${paramsString}"`);
    console.log(`   Manual signature: ${manualSignature}`);
    
    // Method 2: Cloudinary utils signature generation
    const cloudinarySignature = cloudinary.utils.api_sign_request(
      uploadParams,
      config.api_secret!
    );
    
    console.log(`   Cloudinary utils signature: ${cloudinarySignature}`);
    console.log(`   Signatures match: ${manualSignature === cloudinarySignature ? '✅' : '❌'}`);
    
    // Step 4: Test actual upload parameters that would be sent to Cloudinary
    console.log('📤 Testing Upload Parameters...');
    
    const formDataParams = {
      folder,
      timestamp: timestamp.toString(),
      api_key: config.api_key!,
      signature: cloudinarySignature,
    };
    
    console.log('   FormData parameters that would be sent:');
    Object.entries(formDataParams).forEach(([key, value]) => {
      console.log(`     ${key}: ${value}`);
    });
    
    // Step 5: Test with a minimal actual upload (using a 1x1 transparent PNG)
    console.log('🖼️ Testing Minimal Upload...');
    
    // Create a minimal 1x1 transparent PNG as base64
    const minimalPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9RGG5VwAAAABJRU5ErkJggg==';
    
    try {
      const uploadResult = await cloudinary.uploader.upload(
        `data:image/png;base64,${minimalPng}`,
        {
          folder: 'pawtraits/originals',
          public_id: `test_upload_${timestamp}`,
          resource_type: 'image',
          overwrite: true
        }
      );
      
      console.log(`   Test upload: ✅ Success`);
      console.log(`   Public ID: ${uploadResult.public_id}`);
      console.log(`   Secure URL: ${uploadResult.secure_url}`);
      
      // Clean up test image
      try {
        await cloudinary.uploader.destroy(uploadResult.public_id);
        console.log(`   Cleanup: ✅ Test image deleted`);
      } catch (cleanupError) {
        console.log(`   Cleanup: ⚠️ Failed to delete test image`);
      }
      
    } catch (uploadError) {
      console.error(`   Test upload: ❌ Failed - ${uploadError}`);
      return NextResponse.json({
        error: 'Test upload failed',
        config: {
          cloud_name: config.cloud_name,
          api_key: config.api_key,
          api_secret_length: config.api_secret?.length
        },
        signature_test: {
          string_to_sign: paramsString,
          manual_signature: manualSignature,
          cloudinary_signature: cloudinarySignature,
          signatures_match: manualSignature === cloudinarySignature
        },
        upload_error: uploadError instanceof Error ? uploadError.message : 'Unknown error'
      }, { status: 500 });
    }
    
    // Step 6: Return diagnostic results
    return NextResponse.json({
      status: 'success',
      message: 'All Cloudinary tests passed!',
      config: {
        cloud_name: config.cloud_name,
        api_key: config.api_key,
        api_secret_length: config.api_secret?.length
      },
      signature_test: {
        timestamp,
        folder,
        string_to_sign: paramsString,
        manual_signature: manualSignature,
        cloudinary_signature: cloudinarySignature,
        signatures_match: manualSignature === cloudinarySignature
      },
      upload_test: {
        folder_exists: true,
        upload_successful: true
      }
    });
    
  } catch (error) {
    console.error('❌ Cloudinary test failed:', error);
    return NextResponse.json({
      error: 'Cloudinary test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing Direct Upload Signature Generation');
    
    const { folder = 'pawtraits/originals' } = await request.json();
    const timestamp = Math.round(Date.now() / 1000);
    
    // Create the exact same signature as our signed-upload endpoint (FIXED VERSION)
    const uploadParams = {
      timestamp,
      folder
      // resource_type removed - not included in Cloudinary's signature validation
    };
    
    // Remove undefined values (same as our endpoint)
    const cleanParams = Object.fromEntries(
      Object.entries(uploadParams).filter(([_, value]) => value !== undefined)
    );
    
    console.log('Parameters for signature:', cleanParams);
    
    // Generate signature using Cloudinary's utils (same as our endpoint)
    const signature = cloudinary.utils.api_sign_request(
      cleanParams,
      process.env.CLOUDINARY_API_SECRET!
    );
    
    const response = {
      signature,
      timestamp,
      api_key: process.env.CLOUDINARY_API_KEY!,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
      folder,
      resource_type: 'image', // Client needs this but NOT part of signature
      // Diagnostic info
      string_to_sign: Object.keys(cleanParams)
        .sort()
        .map(key => `${key}=${cleanParams[key]}`)
        .join('&'),
      params_signed: cleanParams
    };
    
    console.log('Generated signature response:', {
      ...response,
      api_key: response.api_key?.substring(0, 8) + '...',
    });
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('❌ POST test failed:', error);
    return NextResponse.json({
      error: 'Signature generation test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}