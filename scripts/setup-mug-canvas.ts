/**
 * One-time setup: upload white canvas base image to Cloudinary.
 * Run: tsx scripts/setup-mug-canvas.ts
 *
 * Uploads a 2362×1134 white JPEG to:
 *   public_id: pawtraits/mugs/white_canvas_2362x1134
 */

import { v2 as cloudinary } from 'cloudinary';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const TARGET_PUBLIC_ID = 'pawtraits/mugs/white_canvas_2362x1134';

async function main() {
  console.log('🖼️  Setting up mug white canvas base image...');
  console.log(`   Cloud: ${process.env.CLOUDINARY_CLOUD_NAME}`);
  console.log(`   Target public_id: ${TARGET_PUBLIC_ID}`);

  // Check if canvas already exists
  try {
    const existing = await cloudinary.api.resource(TARGET_PUBLIC_ID);
    console.log('✅ Canvas already exists:', existing.secure_url);
    console.log(`   Dimensions: ${existing.width}x${existing.height}`);
    return;
  } catch {
    console.log('ℹ️  Canvas not found — uploading now...');
  }

  // Build a 2362x1134 white JPEG as a minimal data URI
  // We use Cloudinary's fetch from a data URI approach with a white SVG
  const WHITE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="2362" height="1134"><rect width="2362" height="1134" fill="white"/></svg>`;
  const svgBase64 = Buffer.from(WHITE_SVG).toString('base64');
  const dataUri = `data:image/svg+xml;base64,${svgBase64}`;

  try {
    const result = await cloudinary.uploader.upload(dataUri, {
      public_id: TARGET_PUBLIC_ID,
      folder: undefined, // public_id already includes folder path
      overwrite: true,
      resource_type: 'image',
      type: 'upload',
      format: 'jpg',
      quality: 100,
      transformation: [
        { width: 2362, height: 1134, crop: 'fill', background: 'white' }
      ]
    });

    console.log('✅ Canvas uploaded successfully!');
    console.log(`   public_id: ${result.public_id}`);
    console.log(`   Dimensions: ${result.width}x${result.height}`);
    console.log(`   URL: ${result.secure_url}`);
  } catch (error) {
    console.error('❌ Upload failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);
