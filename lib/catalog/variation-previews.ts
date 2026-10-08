import { v2 as cloudinary } from 'cloudinary';

// Admin variation previews live on Cloudinary, not in the API response: four 2K PNGs as
// base64 are well over Vercel's 4.5 MB response limit, so the browser got nothing back.

const PREVIEW_FOLDER = 'pawtraits/variation-previews';
export const PREVIEW_TAG = 'variation-preview';

function configure() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary is not configured');
  }
  cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET, secure: true });
}

export interface VariationPreview {
  preview_public_id: string;
  preview_url: string;        // full size PNG, used when saving
  preview_thumb_url: string;  // ~768px PNG, used for display and AI descriptions
  width: number;
  height: number;
}

export async function uploadVariationPreview(buffer: Buffer, filename: string): Promise<VariationPreview> {
  configure();
  const result: any = await new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          // Full path in the public id (not `folder`), so the id is the same in fixed- and
          // dynamic-folder Cloudinary accounts and promoteVariationPreview can rely on it
          public_id: `${PREVIEW_FOLDER}/${filename.replace(/\.[^.]+$/, '')}`,
          resource_type: 'image',
          type: 'upload',
          tags: [PREVIEW_TAG],
          overwrite: false,
          unique_filename: true,
        },
        (error, res) => (error ? reject(error) : resolve(res))
      )
      .end(buffer);
  });
  return {
    preview_public_id: result.public_id,
    preview_url: result.secure_url,
    preview_thumb_url: cloudinary.url(result.public_id, {
      secure: true,
      version: result.version,
      transformation: [{ width: 768, height: 768, crop: 'limit' }],
      format: 'png',
    }),
    width: result.width,
    height: result.height,
  };
}

/** Source image for Gemini, fetched server-side (capped at 2048px so the input stays small). */
export async function loadCatalogImageBase64(image: { cloudinary_public_id?: string | null; public_url?: string | null }): Promise<string> {
  let url: string | null = null;
  if (image.cloudinary_public_id) {
    configure();
    url = cloudinary.url(image.cloudinary_public_id, {
      secure: true,
      transformation: [{ width: 2048, height: 2048, crop: 'limit' }],
      format: 'png',
    });
  } else if (image.public_url && /^https:\/\//.test(image.public_url)) {
    url = image.public_url;
  }
  if (!url) throw new Error('This design has no stored image');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load the design image (${res.status})`);
  return Buffer.from(await res.arrayBuffer()).toString('base64');
}

const CATALOGUE_FOLDER = 'pawtraits/variations';

/**
 * Move a saved preview into the catalogue folder on Cloudinary (a rename: no download, no
 * re-upload) and drop its preview tag, so preview clean-up never touches it.
 */
export async function promoteVariationPreview(previewPublicId: string, filename: string): Promise<{ public_id: string; secure_url: string; width: number; height: number; bytes: number; format: string }> {
  if (!previewPublicId.startsWith(`${PREVIEW_FOLDER}/`)) throw new Error('Not a variation preview');
  configure();
  const stem = filename.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').slice(0, 80) || 'variation';
  let target = `${CATALOGUE_FOLDER}/${stem}`;
  let res: any;
  try {
    res = await cloudinary.uploader.rename(previewPublicId, target, { overwrite: false, invalidate: true });
  } catch (e: any) {
    // Name taken (e.g. saved twice): add a short suffix and try once more
    if (!/already exists/i.test(e?.message || e?.error?.message || '')) throw e;
    target = `${target}-${Math.random().toString(36).slice(2, 7)}`;
    res = await cloudinary.uploader.rename(previewPublicId, target, { overwrite: false, invalidate: true });
  }
  await cloudinary.uploader.remove_tag(PREVIEW_TAG, [res.public_id]).catch(() => undefined);
  return { public_id: res.public_id, secure_url: res.secure_url, width: res.width, height: res.height, bytes: res.bytes, format: res.format };
}
