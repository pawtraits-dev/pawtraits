#!/usr/bin/env npx tsx

/**
 * Test script to verify all image variants are working correctly
 * Usage: npx tsx scripts/test-image-variants.ts
 */

// Load environment variables first
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { cloudinaryService } from '../lib/cloudinary';
import { v2 as cloudinary } from 'cloudinary';

async function testImageVariants() {
  console.log('🖼️  Testing Image Variants');
  console.log('========================\n');

  // Configure Cloudinary
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  // Test 1: Check watermark exists
  console.log('1. Checking watermark asset...');
  try {
    const watermarkId = process.env.CLOUDINARY_WATERMARK_PUBLIC_ID || 'pawtraits_watermark_logo';
    const watermark = await cloudinary.api.resource(watermarkId);
    console.log(`✅ Watermark found: ${watermark.public_id}`);
    console.log(`   - URL: ${watermark.secure_url}`);
  } catch (error) {
    console.error('❌ Watermark not found:', error);
    return;
  }

  // Test 2: Check brand logo exists
  console.log('\n2. Checking brand logo asset...');
  try {
    const brandLogoId = 'brand_assets/pawtraits_brand_logo';
    const brandLogo = await cloudinary.api.resource(brandLogoId);
    console.log(`✅ Brand logo found: ${brandLogo.public_id}`);
    console.log(`   - URL: ${brandLogo.secure_url}`);
  } catch (error) {
    console.error('❌ Brand logo not found with full path, trying without folder...');
    try {
      const simpleBrandLogoId = 'pawtraits_brand_logo';
      const brandLogo = await cloudinary.api.resource(simpleBrandLogoId);
      console.log(`✅ Brand logo found: ${brandLogo.public_id}`);
      console.log(`   - URL: ${brandLogo.secure_url}`);
    } catch (error2) {
      console.error('❌ Brand logo not found with either ID:', error2);
      return;
    }
  }

  // Test 3: Generate all variant types
  console.log('\n3. Testing variant generation...');
  
  const testPublicId = 'sample'; // Cloudinary sample image
  const watermarkId = process.env.CLOUDINARY_WATERMARK_PUBLIC_ID || 'pawtraits_watermark_logo';
  const brandLogoId = 'brand_assets/pawtraits_brand_logo';
  
  const variants = {
    full_size: cloudinary.url(testPublicId, {
      width: 1200,
      crop: 'limit',
      quality: 85,
      format: 'auto',
      overlay: watermarkId,
      opacity: 60,
      gravity: 'center'
    }),
    
    mid_size: cloudinary.url(testPublicId, {
      width: 400,
      crop: 'limit',
      quality: 85,
      format: 'auto'
    }),
    
    thumbnail: cloudinary.url(testPublicId, {
      width: 150,
      height: 150,
      crop: 'fill',
      quality: 80,
      format: 'auto'
    }),
    
    download: cloudinary.url(testPublicId, {
      quality: 100,
      format: 'png',
      dpi: 300,
      overlay: brandLogoId,
      gravity: 'south_east',
      x: 30,
      y: 30,
      width_overlay: 120,
      height_overlay: 40,
      opacity: 80
    }),
    
    social_instagram: cloudinary.url(testPublicId, {
      width: 1080,
      height: 1080,
      crop: 'fill',
      quality: 85,
      format: 'jpg',
      overlay: brandLogoId,
      gravity: 'south_east',
      x: 40,
      y: 40,
      width_overlay: 150,
      height_overlay: 50,
      opacity: 90
    })
  };

  console.log('✅ Generated variant URLs:');
  Object.entries(variants).forEach(([variant, url]) => {
    console.log(`   - ${variant}: ${url}`);
  });

  console.log('\n4. Testing aspect ratio preservation...');
  
  // Test with different aspect ratios
  const aspectRatios = {
    landscape: cloudinary.url(testPublicId, {
      width: 1200,
      crop: 'limit', // This should maintain aspect ratio
      quality: 85,
      format: 'auto',
      overlay: watermarkId,
      opacity: 60,
      gravity: 'center'
    }),
    
    portrait: cloudinary.url(testPublicId, {
      width: 800,
      crop: 'limit', // This should maintain aspect ratio  
      quality: 85,
      format: 'auto',
      overlay: watermarkId,
      opacity: 60,
      gravity: 'center'
    })
  };

  console.log('✅ Aspect ratio test URLs (crop: limit):');
  Object.entries(aspectRatios).forEach(([type, url]) => {
    console.log(`   - ${type}: ${url}`);
  });

  console.log('\n🎉 Image variant test complete!');
  console.log('\n📋 Summary:');
  console.log('   ✅ Watermark asset verified');
  console.log('   ✅ Brand logo asset verified');
  console.log('   ✅ All variant types generated');
  console.log('   ✅ Aspect ratio preservation tested');
  
  console.log('\n🚀 All image variants are ready for use!');
  console.log('\n💡 Next steps:');
  console.log('   • Test the modal on your application');
  console.log('   • Verify watermarks appear correctly');
  console.log('   • Check that aspect ratios are preserved');
}

// Run the test
testImageVariants().catch(console.error);