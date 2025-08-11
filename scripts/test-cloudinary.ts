#!/usr/bin/env npx tsx

/**
 * Test script for Cloudinary integration
 * Usage: npx tsx scripts/test-cloudinary.ts
 */

// Load environment variables first
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { cloudinaryService } from '../lib/cloudinary';
import * as path from 'path';
import * as fs from 'fs';

async function testCloudinaryIntegration() {
  console.log('🧪 Testing Cloudinary Integration');
  console.log('================================\n');

  // Test 1: Connection
  console.log('1. Testing Cloudinary connection...');
  const connectionOk = await cloudinaryService.testConnection();
  if (!connectionOk) {
    console.error('❌ Cloudinary connection failed. Check your credentials in .env.local');
    process.exit(1);
  }

  // Test 2: Watermark check
  console.log('\n2. Checking watermark availability...');
  const watermarkPath = path.join(process.cwd(), 'public/assets/watermarks/pawtraits-logo.svg');
  
  if (fs.existsSync(watermarkPath)) {
    console.log('✅ Watermark SVG found locally');
    
    console.log('3. Uploading watermark to Cloudinary...');
    const uploaded = await cloudinaryService.uploadWatermark(watermarkPath);
    if (uploaded) {
      console.log('✅ Watermark uploaded successfully');
    } else {
      console.warn('⚠️ Watermark upload failed - check manually in Cloudinary dashboard');
    }
  } else {
    console.warn('⚠️ Watermark SVG not found. Please place your watermark at:');
    console.warn(`   ${watermarkPath}`);
    console.warn('   Then re-run this test script.');
  }

  // Test 3: Generate sample image variants (without actual upload)
  console.log('\n4. Testing URL generation...');
  try {
    const testPublicId = 'test_sample_image';
    
    // Test various URL generation methods
    const printUrl = await cloudinaryService.getPrintQualityUrl(testPublicId, 'test-user-id');
    console.log('✅ Print quality URL generated');
    
    const socialUrls = await cloudinaryService.getSocialMediaUrls(testPublicId, 'test-user-id', 'test-order-id');
    console.log('✅ Social media URLs generated');
    console.log(`   - Instagram: ${socialUrls.instagram_post}`);
    console.log(`   - Facebook: ${socialUrls.facebook_post}`);
    
  } catch (error) {
    console.error('❌ URL generation failed:', error);
  }

  console.log('\n🎉 Cloudinary integration test complete!');
  console.log('\nNext steps:');
  console.log('1. Place your watermark SVG in /public/assets/watermarks/pawtraits-logo.svg');
  console.log('2. Run database migration: Execute db/cloudinary-migration-schema.sql in Supabase');
  console.log('3. Test with real image upload when ready');
}

// Run the test
testCloudinaryIntegration().catch(console.error);