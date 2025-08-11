#!/usr/bin/env npx tsx

/**
 * Upload watermark to Cloudinary
 * Usage: npm run upload-watermark
 */

// Load environment variables first
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { cloudinaryService } from '../lib/cloudinary';
import * as path from 'path';
import * as fs from 'fs';

async function uploadWatermark() {
  console.log('📤 Uploading Watermark to Cloudinary');
  console.log('===================================\n');

  // Check if watermark file exists
  const watermarkPath = path.join(process.cwd(), 'public/assets/watermarks/pawtraits-logo.svg');
  
  if (!fs.existsSync(watermarkPath)) {
    console.error('❌ Watermark SVG not found!');
    console.log('📁 Please place your watermark SVG at:');
    console.log(`   ${watermarkPath}\n`);
    
    // List available files in the directory for help
    const watermarkDir = path.dirname(watermarkPath);
    if (fs.existsSync(watermarkDir)) {
      const files = fs.readdirSync(watermarkDir);
      if (files.length > 0) {
        console.log('📄 Files found in watermarks directory:');
        files.forEach(file => console.log(`   - ${file}`));
        console.log('\n💡 Rename your SVG to "pawtraits-logo.svg" or update the path in the script');
      }
    }
    process.exit(1);
  }

  console.log('✅ Found watermark file:', watermarkPath);

  // Upload to Cloudinary
  console.log('\n🔄 Uploading to Cloudinary...');
  try {
    const success = await cloudinaryService.uploadWatermark(watermarkPath);
    
    if (success) {
      console.log('✅ Watermark uploaded successfully!');
      console.log(`   - Public ID: ${process.env.CLOUDINARY_WATERMARK_PUBLIC_ID || 'pawtraits_watermark_logo'}`);
      console.log(`   - Opacity setting: ${process.env.CLOUDINARY_WATERMARK_OPACITY || '60'}%`);
      
      // Generate preview URL
      const { v2: cloudinary } = await import('cloudinary');
      const previewUrl = cloudinary.url(process.env.CLOUDINARY_WATERMARK_PUBLIC_ID || 'pawtraits_watermark_logo');
      console.log(`   - Preview URL: ${previewUrl}`);
      
      console.log('\n🎉 Watermark is ready for use in image processing!');
      console.log('\n🧪 Next step: Run "npm run test-watermark" to verify everything works');
    } else {
      console.error('❌ Watermark upload failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Upload error:', error);
    process.exit(1);
  }
}

// Run the upload
uploadWatermark().catch(console.error);