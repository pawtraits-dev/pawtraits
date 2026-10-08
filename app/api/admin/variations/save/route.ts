import { NextRequest, NextResponse, after } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { autoTagNew } from '@/lib/collections/auto-tag';
import { promoteVariationPreview } from '@/lib/catalog/variation-previews';
import { registerCloudinaryImage } from '@/lib/catalog/register-image';

export const maxDuration = 60;

/**
 * Save approved variation previews to the catalogue, entirely on the server: each preview is
 * moved on Cloudinary from variation-previews to the catalogue folder (no download or
 * re-upload, whatever the size), then registered like any other design and auto-tagged.
 * Body: { variations: [{ preview_public_id, filename, prompt, description, metadata, theme_id, style_id, ... }] }
 */
export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const variations: any[] = Array.isArray(body?.variations) ? body.variations.slice(0, 50) : [];
  if (variations.length === 0) return NextResponse.json({ error: 'No variations to save' }, { status: 400 });

  const supabase = serviceClient();
  const results = [];
  for (const v of variations) {
    const base = {
      id: v.id,
      variation_type: v.variation_type ?? v.metadata?.variation_type,
      breed_name: v.breed_name,
      coat_name: v.coat_name,
      outfit_name: v.outfit_name,
      format_name: v.format_name,
    };
    try {
      const moved = await promoteVariationPreview(String(v.preview_public_id || ''), String(v.filename || 'variation.png'));
      const saved = await registerCloudinaryImage(supabase, {
        cloudinary_public_id: moved.public_id,
        cloudinary_secure_url: moved.secure_url,
        original_filename: v.filename || `${moved.public_id.split('/').pop()}.${moved.format}`,
        file_size: moved.bytes,
        mime_type: `image/${moved.format === 'jpg' ? 'jpeg' : moved.format}`,
        prompt_text: v.prompt || '',
        description: v.description || `Generated variation: ${base.variation_type ?? ''}`.trim(),
        tags: v.metadata?.tags || ['variation', 'gemini-generated'],
        breed_id: v.metadata?.breed_id,
        coat_id: v.metadata?.coat_id,
        format_id: v.metadata?.format_id,
        theme_id: v.theme_id,
        style_id: v.style_id,
        rating: v.rating ?? 4,
        is_featured: !!v.is_featured,
        is_public: v.is_public !== false,
      });
      after(() => autoTagNew(supabase, saved.id));
      results.push({ ...base, success: true, database_id: saved.id, cloudinary_url: moved.secure_url, width: moved.width, height: moved.height });
    } catch (e: any) {
      console.error('Variation save failed:', v.preview_public_id, e);
      results.push({ ...base, success: false, error: e?.message || e?.error?.message || 'Save failed' });
    }
  }
  return NextResponse.json(results);
}
