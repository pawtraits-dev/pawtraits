/**
 * Uploads the watermark paw (public/assets/watermarks/pawtraits-paw.png: the blue site paw,
 * right way up) to Cloudinary as "pawtraits_watermark_paw", used by lib/watermark.ts.
 *   npx tsx scripts/upload-watermark-paw.ts
 */
import { config } from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';

config({ path: '.env.local' });
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

cloudinary.uploader.upload('public/assets/watermarks/pawtraits-paw.png', {
  public_id: 'pawtraits_watermark_paw', overwrite: true, invalidate: true, resource_type: 'image',
}).then(r => console.log(`✅ Uploaded ${r.public_id} (${r.width}×${r.height}): ${r.secure_url}`))
  .catch(e => { console.error('❌ Upload failed:', e?.message || e); process.exit(1); });
