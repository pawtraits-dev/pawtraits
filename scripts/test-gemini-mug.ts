/**
 * Gemini Mug Pipeline — End-to-End Test
 *
 * Runs the full mug personalisation pipeline without needing the dev server or DB:
 *   1. Fetches a catalog reference image + pet photo as base64
 *   2. Calls Gemini 2.0 Flash image generation
 *   3. Uploads the result to Cloudinary
 *   4. Calls buildMugPreviewUrl() to build the composite URL
 *   5. Prints both URLs for visual verification in the browser
 *
 * Usage:
 *   npx tsx scripts/test-gemini-mug.ts
 *
 * Prerequisites:
 *   - GEMINI_API_KEY, CLOUDINARY_* env vars in .env.local
 *   - white_canvas_2362x1134 uploaded to Cloudinary (run setup-mug-canvas.ts first)
 *   - A catalog image URL (update CATALOG_IMAGE_URL below after uploading via admin)
 */

import { GoogleGenAI } from '@google/genai';
import { v2 as cloudinary } from 'cloudinary';
import * as dotenv from 'dotenv';
import { buildMugPreviewUrl } from '../lib/cloudinary-mug';
import type { MugColour, MugCatalogEntry } from '../lib/product-types';
import { GEMINI_IMAGE_MODELS } from '../lib/gemini-models';

dotenv.config({ path: '.env.local' });

// ─── Test configuration ────────────────────────────────────────────────────
// Update CATALOG_IMAGE_URL once you've uploaded an Aries reference image via admin.
// Until then, we use a placeholder Cloudinary URL for the canvas itself so the
// composite (Stage 2) can still be verified independently.
const CATALOG_IMAGE_URL =
  process.env.TEST_CATALOG_IMAGE_URL ||
  `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/pawtraits/mugs/white_canvas_2362x1134`;

const PET_PHOTO_PUBLIC_ID = 'pawcasso-progress-4_epyie9';

// Navy colour
const NAVY_COLOUR: MugColour = {
  id: 'test-navy',
  name: 'Navy',
  slug: 'navy',
  hex: '012168',
  text_hex: 'FDD26E',
  overlay_hex: '012168',
  sort_order: 2,
  is_active: true,
};

// Aries catalog entry (placeholder until real entry is created via admin)
const ARIES_ENTRY: MugCatalogEntry = {
  id: 'test-aries',
  type: 'zodiac',
  slug: 'aries',
  name: 'Aries',
  sub_heading: 'The Fearless Adventurer',
  description: 'Bold, brave and always first — your Aries pet charges head-first into every adventure.',
  description_short: 'Bold, brave and always first — your Aries pet charges head-first into every adventure.',
  catalog_image_url: CATALOG_IMAGE_URL,
  catalog_image_public_id: 'pawtraits/mugs/catalog/aries',
  animal_type: 'both',
  is_active: true,
  sort_order: 1,
};
// ──────────────────────────────────────────────────────────────────────────

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function buildGeminiPrompt(hex: string): string {
  return `Replace the animal in the reference scene image with the specific pet from the uploaded photo. Preserve the exact composition, pose, background, props, and artistic style of the reference scene. Match the uploaded pet's breed, coat colour, markings, and facial features as closely as possible.
Recolour all decorative highlight elements (crown, collar, hat, ribbons, scarves, props) to the colour hex #${hex}.
Maintain the original artistic style (sketch / illustration / painterly) exactly.
Do not add any text to the image.
Output a square image at the same resolution as the reference.`;
}

async function fetchImageAsBase64(url: string): Promise<string> {
  console.log(`  Fetching: ${url.substring(0, 80)}...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image (${res.status}): ${url}`);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf).toString('base64');
}

async function main() {
  console.log('🧪 Gemini Mug Pipeline Test\n');

  // Validate env vars
  const missing = ['GEMINI_API_KEY', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']
    .filter(k => !process.env[k]);
  if (missing.length) {
    console.error(`❌ Missing env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  const petPhotoUrl = cloudinary.url(PET_PHOTO_PUBLIC_ID, { secure: true });
  console.log(`Pet photo URL:    ${petPhotoUrl}`);
  console.log(`Catalog image:    ${CATALOG_IMAGE_URL}`);
  console.log(`Colour:           Navy (#${NAVY_COLOUR.hex})\n`);

  // ─── Stage 1: Gemini ──────────────────────────────────────────────────
  console.log('Stage 1 — Fetching images for Gemini...');
  const [catalogBase64, petBase64] = await Promise.all([
    fetchImageAsBase64(CATALOG_IMAGE_URL),
    fetchImageAsBase64(petPhotoUrl),
  ]);

  const prompt = buildGeminiPrompt(NAVY_COLOUR.hex);
  console.log(`\nGemini prompt:\n${prompt}\n`);

  console.log('Calling Gemini 2.0 Flash Preview Image Generation...');
  const startTime = Date.now();

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const geminiResponse = await ai.models.generateContent({
    model: GEMINI_IMAGE_MODELS.flash,
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType: 'image/jpeg', data: catalogBase64 } },
          { inlineData: { mimeType: 'image/jpeg', data: petBase64 } },
        ],
      },
    ],
    config: { responseModalities: ['IMAGE', 'TEXT'] },
  } as any);

  const elapsedMs = Date.now() - startTime;
  console.log(`✅ Gemini responded in ${(elapsedMs / 1000).toFixed(1)}s`);

  // Extract image from response
  let personalisedBase64: string | null = null;
  if (geminiResponse.candidates?.[0]?.content?.parts) {
    for (const part of geminiResponse.candidates[0].content.parts) {
      if ((part as any).inlineData?.data) {
        personalisedBase64 = (part as any).inlineData.data;
        break;
      }
    }
  }

  if (!personalisedBase64) {
    console.error('❌ Gemini did not return an image. Response:', JSON.stringify(geminiResponse, null, 2));
    process.exit(1);
  }

  // Upload to Cloudinary
  console.log('\nUploading Gemini output to Cloudinary...');
  const uploadResult = await cloudinary.uploader.upload(
    `data:image/png;base64,${personalisedBase64}`,
    {
      folder: 'pawtraits/mugs/generated',
      public_id: `test-output-${Date.now()}`,
      resource_type: 'image',
      type: 'upload',
      tags: ['mug-test'],
      overwrite: true,
    }
  );

  console.log(`✅ Uploaded: ${uploadResult.public_id}`);
  console.log(`   Gemini output URL: ${uploadResult.secure_url}`);

  // ─── Stage 2: Cloudinary composite ───────────────────────────────────
  console.log('\nStage 2 — Building composite preview URL...');
  const previewUrl = buildMugPreviewUrl({
    personalisedImagePublicId: uploadResult.public_id,
    petName: 'Buddy',
    mugColour: NAVY_COLOUR,
    catalogEntry: ARIES_ENTRY,
  });

  console.log('\n' + '='.repeat(70));
  console.log('RESULTS — open these in the browser to verify:');
  console.log('='.repeat(70));
  console.log(`\n1. Gemini personalised image (left panel source):`);
  console.log(`   ${uploadResult.secure_url}`);
  console.log(`\n2. Full mug composite preview (1181×567):`);
  console.log(`   ${previewUrl}`);
  console.log('\n' + '='.repeat(70));
  console.log('\n✅ Pipeline test complete!');
  console.log('   Left panel: pet image with Navy colour highlights');
  console.log('   Right panel: ARIES / The Fearless Adventurer / description');
}

main().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
