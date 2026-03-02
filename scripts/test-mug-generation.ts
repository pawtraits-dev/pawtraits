/**
 * Test mug composite URL generation.
 * Run: tsx scripts/test-mug-generation.ts
 *
 * Prints preview and print URLs to console.
 * Open them in a browser to visually verify the composite layout.
 */

import * as dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';
import { buildMugPreviewUrl, buildMugPrintUrl, MUG_LAYOUT } from '../lib/cloudinary-mug';
import type { MugColour, MugCatalogEntry } from '../lib/product-types';

dotenv.config({ path: '.env.local' });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Test data — replace with actual public_ids after running setup-mug-canvas.ts
// and uploading a test catalog image
const testColour: MugColour = {
  id: 'test-colour-id',
  name: 'Navy',
  slug: 'navy',
  hex: '012168',
  text_hex: 'FDD26E',
  overlay_hex: '012168',
  sort_order: 2,
  is_active: true,
  created_at: new Date().toISOString(),
};

const testCatalogEntry: MugCatalogEntry = {
  id: 'test-catalog-id',
  type: 'zodiac',
  slug: 'aries',
  name: 'Aries',
  sub_heading: 'The Fearless Adventurer',
  description: 'Bold, brave and always first — your Aries pet leads the way with boundless energy and unstoppable spirit. A natural trailblazer with a heart of gold.',
  description_short: 'Bold, brave and always first — your Aries pet leads the way with boundless energy and unstoppable spirit.',
  catalog_image_url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
  catalog_image_public_id: 'sample', // Replace with actual Cloudinary public_id
  animal_type: 'both',
  is_active: true,
  sort_order: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// 'samples:animals:cat' is a Cloudinary built-in demo image (colons = path separators in overlays)
const TEST_PERSONALISED_IMAGE_PUBLIC_ID = 'pawcasso-progress-4_epyie9';

async function main() {
  console.log('🧪 Testing mug composite URL generation...\n');
  console.log('Configuration:');
  console.log(`  Cloud Name: ${process.env.CLOUDINARY_CLOUD_NAME}`);
  console.log(`  Canvas: ${MUG_LAYOUT.CANVAS_PUBLIC_ID}`);
  console.log(`  Canvas Size: ${MUG_LAYOUT.CANVAS_WIDTH}×${MUG_LAYOUT.CANVAS_HEIGHT}px`);
  console.log(`  Preview Width: ${MUG_LAYOUT.PREVIEW_WIDTH}px\n`);

  const params = {
    personalisedImagePublicId: TEST_PERSONALISED_IMAGE_PUBLIC_ID,
    petName: 'Charlie',
    mugColour: testColour,
    catalogEntry: testCatalogEntry,
  };

  const previewUrl = buildMugPreviewUrl(params);
  const printUrl = buildMugPrintUrl(params);

  console.log('🖼️  PREVIEW URL (open in browser to verify layout):');
  console.log(previewUrl);
  console.log('\n🖨️  PRINT URL (full resolution 2362×1134):');
  console.log(printUrl);

  console.log('\n📐 Layout constants (tune in lib/cloudinary-mug.ts):');
  Object.entries(MUG_LAYOUT).forEach(([key, value]) => {
    if (!key.includes('PUBLIC_ID') && !key.includes('FONT_FAMILY') && !key.includes('COLOUR') && !key.includes('CANVAS')) {
      console.log(`  ${key}: ${value}`);
    }
  });

  console.log('\n✅ Done. Open the preview URL in your browser to check the composite layout.');
}

main().catch(console.error);
