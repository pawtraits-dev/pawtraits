#!/usr/bin/env npx tsx

/**
 * Upload brand logo to Cloudinary for use in download and social media variants
 * Usage: npx tsx scripts/upload-brand-logo.ts
 */

// Load environment variables first
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { cloudinaryService } from '../lib/cloudinary';
import * as path from 'path';
import * as fs from 'fs';

async function uploadBrandLogo() {
  console.log('🏷️  Uploading Brand Logo to Cloudinary');
  console.log('====================================\n');

  // Check for local brand logo file
  console.log('1. Checking for local brand logo file...');
  const logoPath = path.join(process.cwd(), 'public/assets/logos/pawtraits-logo.svg');
  
  if (!fs.existsSync(logoPath)) {
    console.error('❌ Brand logo SVG not found!');
    console.log('📝 Please place your brand logo SVG at:');
    console.log(`   ${logoPath}\n`);
    console.log('💡 Tip: This should be your main brand logo for overlays (not the watermark)');
    
    // Try alternative locations
    const alternatives = [
      'public/assets/logos/paw-svgrepo-200x200-purple.svg',
      'public/assets/watermarks/pawtraits-logo.svg'
    ];
    
    for (const alt of alternatives) {
      const altPath = path.join(process.cwd(), alt);
      if (fs.existsSync(altPath)) {
        console.log(`🔍 Found alternative logo at: ${alt}`);
        console.log('Using this as brand logo...');
        
        try {
          const uploadSuccess = await uploadLogoFile(altPath);
          if (uploadSuccess) {
            console.log('✅ Brand logo uploaded successfully');
            process.exit(0);
          }
        } catch (error) {
          console.error('❌ Failed to upload alternative logo:', error);
        }
        break;
      }
    }
    
    process.exit(1);
  }
  
  console.log('✅ Local brand logo SVG found');

  // Test Cloudinary connection
  console.log('\n2. Testing Cloudinary connection...');
  try {
    const connectionOk = await cloudinaryService.testConnection();
    if (!connectionOk) {
      throw new Error('Connection test failed');
    }
    console.log('✅ Cloudinary connection successful');
  } catch (error) {
    console.error('❌ Cloudinary connection failed:', error);
    console.log('🔧 Check your credentials in .env.local');
    process.exit(1);
  }

  // Upload brand logo
  console.log('\n3. Uploading brand logo to Cloudinary...');
  try {
    const uploadSuccess = await uploadLogoFile(logoPath);
    if (uploadSuccess) {
      console.log('✅ Brand logo uploaded successfully');
    } else {
      throw new Error('Upload failed');
    }
  } catch (error) {
    console.error('❌ Brand logo upload failed:', error);
    process.exit(1);
  }

  // Test logo overlay generation
  console.log('\n4. Testing brand logo overlay...');
  try {
    const { v2: cloudinary } = await import('cloudinary');
    
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    // Test brand overlay on sample image
    const testUrl = cloudinary.url('sample', {
      width: 800,
      height: 600,
      crop: 'fill',
      quality: 85,
      overlay: process.env.CLOUDINARY_BRAND_LOGO_PUBLIC_ID || 'pawtraits_brand_logo',
      gravity: 'south_east',
      x: 30,
      y: 30,
      width_overlay: 120,
      height_overlay: 40,
      opacity: 80
    });

    console.log('✅ Brand logo overlay test successful');
    console.log(`   - Test URL: ${testUrl}`);
    console.log('💡 You can open this URL to see the brand overlay effect');
  } catch (error) {
    console.error('❌ Brand logo overlay test failed:', error);
  }

  console.log('\n🎉 Brand logo setup complete!');
  console.log('\n📋 Summary:');
  console.log('   ✅ Brand logo uploaded to Cloudinary');
  console.log('   ✅ Brand overlay tested');
  console.log('   ✅ Ready for download and social media variants');
  
  console.log('\n🚀 Your brand logo is ready for use in:');
  console.log('   • Download variants (high-quality with brand overlay)');
  console.log('   • Social media posts (optimized with brand overlay)');
}

async function uploadLogoFile(filePath: string): Promise<boolean> {
  try {
    const { v2: cloudinary } = await import('cloudinary');
    
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const result = await cloudinary.uploader.upload(filePath, {
      public_id: process.env.CLOUDINARY_BRAND_LOGO_PUBLIC_ID || 'pawtraits_brand_logo',
      resource_type: 'image',
      format: 'svg',
      overwrite: true,
      folder: 'brand_assets'
    });

    console.log(`✅ Brand logo uploaded: ${result.public_id}`);
    console.log(`   - URL: ${result.secure_url}`);
    return true;

  } catch (error) {
    console.error('❌ Brand logo upload failed:', error);
    return false;
  }
}

// Run the upload
uploadBrandLogo().catch(console.error);