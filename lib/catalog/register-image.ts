import type { SupabaseClient } from '@supabase/supabase-js';
import { cloudinaryService } from '@/lib/cloudinary';
import type { ImageCatalogCreate } from '@/lib/types';

/**
 * Turning an image that is already on Cloudinary into a catalogue design. Shared by
 * /api/images/cloudinary (browser uploads) and /api/admin/variations/save (variation
 * previews moved on Cloudinary, no re-upload).
 */

/** The URLs stored in image_catalog.image_variants */
export function catalogVariants(publicId: string, secureUrl: string): Record<string, any> {
  try {
    return {
      original: { url: secureUrl, access_type: 'print_fulfillment_only', dpi: 300, overlay: 'none', description: 'For printing' },
      full_size: { url: cloudinaryService.getPublicVariantUrl(publicId, 'full_size'), access_type: 'public', overlay: 'watermark_center', description: 'Detail page / modal' },
      thumbnail: { url: cloudinaryService.getPublicVariantUrl(publicId, 'thumbnail'), access_type: 'public', size: 'small', overlay: 'none', description: 'In rows or carts' },
      mid_size: { url: cloudinaryService.getPublicVariantUrl(publicId, 'mid_size'), access_type: 'public', size: 'medium', overlay: 'none', description: 'Shop / catalog cards' },
    };
  } catch (e) {
    console.error('❌ Failed to generate image variants:', e);
    return { original: { url: secureUrl, access_type: 'print_fulfillment_only' }, public: { url: secureUrl, access_type: 'public' } };
  }
}

export interface RegisterInput {
  cloudinary_public_id: string;
  cloudinary_secure_url: string;
  original_filename: string;
  file_size: number;
  mime_type?: string;
  prompt_text: string;
  description?: string;
  tags?: string[];
  breed_id?: string | null;
  theme_id?: string | null;
  style_id?: string | null;
  format_id?: string | null;
  coat_id?: string | null;
  rating?: number | null;
  is_featured?: boolean;
  is_public?: boolean;
}

const FK_TABLES: [keyof RegisterInput, string, string][] = [
  ['breed_id', 'breeds', 'Breed'],
  ['coat_id', 'coats', 'Coat'],
  ['theme_id', 'themes', 'Theme'],
  ['style_id', 'styles', 'Style'],
  ['format_id', 'formats', 'Format'],
];

/** Check the ids exist, then insert the image_catalog row. Throws on failure. */
export async function registerCloudinaryImage(supabase: SupabaseClient, input: RegisterInput): Promise<any> {
  const variants = catalogVariants(input.cloudinary_public_id, input.cloudinary_secure_url);

  for (const [key, table, label] of FK_TABLES) {
    const id = input[key] as string | null | undefined;
    if (!id) continue;
    const { data } = await supabase.from(table).select('id').eq('id', id).maybeSingle();
    if (!data) throw new Error(`${label} ID ${id} not found in database`);
  }

  const ext = (input.original_filename.split('.').pop() || 'png').toLowerCase();
  const row: ImageCatalogCreate = {
    filename: `${input.cloudinary_public_id}.${ext}`,
    original_filename: input.original_filename,
    file_size: input.file_size,
    mime_type: input.mime_type || 'image/png',
    storage_path: `cloudinary:${input.cloudinary_public_id}`,
    public_url: variants.mid_size?.url || input.cloudinary_secure_url,
    prompt_text: input.prompt_text,
    description: input.description || '',
    tags: Array.isArray(input.tags) ? input.tags : [],
    breed_id: input.breed_id || undefined,
    theme_id: input.theme_id || undefined,
    style_id: input.style_id || undefined,
    format_id: input.format_id || undefined,
    coat_id: input.coat_id || undefined,
    rating: input.rating || undefined,
    is_featured: input.is_featured || false,
    is_public: input.is_public !== false,
    cloudinary_public_id: input.cloudinary_public_id,
    image_variants: variants,
  } as ImageCatalogCreate;

  const { data, error } = await supabase.from('image_catalog').insert(row).select().single();
  if (error) throw error;
  return data;
}
