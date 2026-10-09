import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/custom-paintings?limit=20[&id=…]
 * Customer paintings with everything that went into them: the design as sent to Gemini,
 * the pet photo(s), the prompt, settings, step timings and the AI calls (tokens, cost, time).
 */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const q = new URL(request.url).searchParams;
  const limit = Math.min(Math.max(Number(q.get('limit')) || 20, 1), 100);
  const supabase = serviceClient();

  let query = supabase
    .from('customer_custom_images')
    .select('id, created_at, generated_at, status, error_message, customer_email, guest_session_id, pet_id, pet_name, pet_image_url, pet_cloudinary_id, catalog_image_id, generated_image_url, generated_cloudinary_id, generation_prompt, generation_metadata, metadata, rating')
    .order('created_at', { ascending: false })
    .limit(limit);
  const id = q.get('id');
  if (id) query = query.eq('id', id);
  const { data: rows, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const catalogIds = Array.from(new Set((rows ?? []).map((r) => r.catalog_image_id).filter(Boolean)));
  const imageIds = (rows ?? []).map((r) => r.id);
  const [designs, calls] = await Promise.all([
    catalogIds.length
      ? supabase.from('image_catalog').select('id, cloudinary_public_id, public_url, description, breeds (name), themes (name), styles (name), formats (name, aspect_ratio)').in('id', catalogIds)
      : Promise.resolve({ data: [] as any[] }),
    imageIds.length
      ? supabase.from('ai_usage').select('customer_image_id, created_at, feature, model, image_size, input_tokens, thinking_tokens, output_image_tokens, cost_usd, duration_ms, success, error').in('customer_image_id', imageIds).order('created_at')
      : Promise.resolve({ data: [] as any[] }),
  ]);
  const designById = new Map((designs.data ?? []).map((d: any) => [d.id, d]));

  return NextResponse.json({
    paintings: (rows ?? []).map((r) => ({
      ...r,
      who: r.customer_email ? 'customer' : 'guest',
      guest_session_id: undefined,
      design: designById.get(r.catalog_image_id) ?? null,
      calls: (calls.data ?? []).filter((c: any) => c.customer_image_id === r.id),
    })),
  });
}
