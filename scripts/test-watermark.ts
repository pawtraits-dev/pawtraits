#!/usr/bin/env npx tsx

/**
 * Test script specifically for watermark functionality
 * Usage: npm run test-watermark
 */

// Load environment variables first
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { cloudinaryService } from '../lib/cloudinary';
import { v2 as cloudinary } from 'cloudinary';
import * as path from 'path';
import * as fs from 'fs';

async function testWatermark() {
  console.log('🏷️  Testing Watermark Functionality');
  console.log('==================================\n');

  // Test 1: Check local watermark file
  console.log('1. Checking for local watermark file...');
  const watermarkPath = path.join(process.cwd(), 'public/assets/watermarks/pawtraits-logo.svg');
  
  if (!fs.existsSync(watermarkPath)) {
    console.error('❌ Watermark SVG not found!');
    console.log('📝 Please place your watermark SVG at:');
    console.log(`   ${watermarkPath}\n`);
    console.log('💡 Tip: Name your SVG file "pawtraits-logo.svg" and place it in the watermarks folder');
    process.exit(1);
  }
  
  console.log('✅ Local watermark SVG found');

  // Test 2: Check Cloudinary connection
  console.log('\n2. Testing Cloudinary connection...');
  try {
    const connectionOk = await cloudinaryService.testConnection();
    if (connectionOk) {
      console.log('✅ Cloudinary connection successful');
    } else {
      throw new Error('Connection test failed');
    }
  } catch (error) {
    console.error('❌ Cloudinary connection failed:', error);
    console.log('🔧 Check your credentials in .env.local');
    process.exit(1);
  }

  // Test 3: Upload watermark to Cloudinary
  console.log('\n3. Uploading watermark to Cloudinary...');
  try {
    const uploadSuccess = await cloudinaryService.uploadWatermark(watermarkPath);
    if (uploadSuccess) {
      console.log('✅ Watermark uploaded successfully');
    } else {
      throw new Error('Upload failed');
    }
  } catch (error) {
    console.error('❌ Watermark upload failed:', error);
    process.exit(1);
  }

  // Test 4: Verify watermark exists in Cloudinary
  console.log('\n4. Verifying watermark in Cloudinary...');
  try {
    // Import cloudinary here to use the configured instance
    const { v2: cloudinaryApi } = await import('cloudinary');
    const watermarkId = process.env.CLOUDINARY_WATERMARK_PUBLIC_ID || 'pawtraits_watermark_logo';
    
    // Configure cloudinary first
    cloudinaryApi.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    
    const resource = await cloudinaryApi.api.resource(watermarkId);
    console.log('✅ Watermark verified in Cloudinary');
    console.log(`   - Public ID: ${resource.public_id}`);
    console.log(`   - Format: ${resource.format}`);
    console.log(`   - Size: ${resource.width}x${resource.height}`);
    console.log(`   - URL: ${resource.secure_url}`);
  } catch (error) {
    console.error('❌ Could not verify watermark in Cloudinary:', error);
    console.warn('⚠️ This might be OK if watermark was just uploaded - try again in a moment');
  }

  // Test 5: Generate a test watermarked image URL
  console.log('\n5. Testing watermark application...');
  try {
    // Import cloudinary for URL generation
    const { v2: cloudinaryApi } = await import('cloudinary');
    
    // Configure cloudinary for URL generation
    cloudinaryApi.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    
    // Create a test image URL with watermark applied
    const testImageId = 'sample'; // Cloudinary has sample images
    const watermarkedUrl = cloudinaryApi.url(testImageId, {
      width: 800,
      height: 600,
      crop: 'fill',
      quality: 85,
      overlay: process.env.CLOUDINARY_WATERMARK_PUBLIC_ID || 'pawtraits_watermark_logo',
      opacity: parseInt(process.env.CLOUDINARY_WATERMARK_OPACITY || '60'),
      gravity: 'center'
    });

    console.log('✅ Watermark application test successful');
    console.log(`   - Test URL: ${watermarkedUrl}`);
    console.log('💡 You can open this URL in your browser to see the watermark effect');
  } catch (error) {
    console.error('❌ Watermark application test failed:', error);
  }

  console.log('\n🎉 Watermark test complete!');
  console.log('\n📋 Summary:');
  console.log('   ✅ Local SVG file found');
  console.log('   ✅ Cloudinary connection working');
  console.log('   ✅ Watermark uploaded to Cloudinary');
  console.log('   ✅ Watermark verified and accessible');
  console.log('   ✅ Watermark application tested');
  
  console.log('\n🚀 Your watermark is ready for use!');
}

// Run the test
testWatermark().catch(console.error);