/**
 * Resolve the image behind an order line. order_items.image_id can point at either:
 *   - image_catalog.id               (a catalogue design bought as-is)
 *   - customer_custom_images.id      (a customised portrait with the customer's pet)
 * Previously only image_catalog was checked, so custom portraits could not be fulfilled.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ResolvedOrderImage {
  kind: 'catalog' | 'custom';
  id: string;
  cloudinaryPublicId: string | null;
  /** unwatermarked stored original, if we have one (fallback only) */
  originalUrl: string | null;
  /** safe-to-display preview (watermarked for custom portraits) */
  previewUrl: string | null;
  filename: string;
  catalogImageId: string | null;
}

export async function resolveOrderImage(supabase: SupabaseClient, imageId: string): Promise<ResolvedOrderImage | null> {
  if (!imageId) return null;

  const { data: cat } = await supabase
    .from('image_catalog')
    .select('id, cloudinary_public_id, public_url, image_variants, filename')
    .eq('id', imageId)
    .maybeSingle();
  if (cat) {
    return {
      kind: 'catalog',
      id: cat.id,
      cloudinaryPublicId: cat.cloudinary_public_id,
      originalUrl: cat.image_variants?.original?.url ?? cat.public_url ?? null,
      previewUrl: cat.public_url ?? null,
      filename: (cat.filename || `pawtraits-${cat.id}`).replace(/\.[a-z0-9]+$/i, ''),
      catalogImageId: cat.id,
    };
  }

  const { data: custom } = await supabase
    .from('customer_custom_images')
    .select('id, generated_cloudinary_id, generated_image_url, generation_metadata, catalog_image_id, pet_name')
    .eq('id', imageId)
    .maybeSingle();
  if (custom) {
    const petSlug = (custom.pet_name || 'pet').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pet';
    return {
      kind: 'custom',
      id: custom.id,
      cloudinaryPublicId: custom.generated_cloudinary_id,
      originalUrl: custom.generation_metadata?.full_size_url ?? null,
      previewUrl: custom.generated_image_url,
      filename: `pawtraits-${petSlug}-${custom.id.slice(0, 8)}`,
      catalogImageId: custom.catalog_image_id,
    };
  }
  return null;
}

/** Unsigned, print-resolution URL Gelato can fetch. Throws rather than guessing. */
export async function getPrintUrl(img: ResolvedOrderImage, orderId: string): Promise<string> {
  if (img.cloudinaryPublicId) {
    const { cloudinaryService } = await import('@/lib/cloudinary');
    return cloudinaryService.getGelatoPrintUrl(img.cloudinaryPublicId, orderId);
  }
  if (img.originalUrl) return img.originalUrl;
  throw new Error(`No print source for ${img.kind} image ${img.id}`);
}

/** Customer download: full quality, small brand mark, signed 7-day URL. */
export async function getCustomerDownloadUrl(img: ResolvedOrderImage, customerRef: string, orderRef: string): Promise<string> {
  if (!img.cloudinaryPublicId) throw new Error(`No download source for ${img.kind} image ${img.id}`);
  const { cloudinaryService } = await import('@/lib/cloudinary');
  return cloudinaryService.getDownloadUrl(img.cloudinaryPublicId, customerRef, orderRef);
}
