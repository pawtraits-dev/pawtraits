/**
 * Admin → Catalogue → a design → Caption plate (lib/captions/).
 * GET   the design's type/sign caption (dog and cat wording), whether it's on, its versions
 * POST  { action: 'apply' | 'remove', versions?: true }  plate on or off (and on its versions)
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { readCaptionOverlay } from '@/lib/captions/caption';
import { CAPTION_MIGRATION, captionDesignAndVersions, designCaption, ensureSymbols } from '@/lib/captions/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const supabase = serviceClient();
  const cap = await designCaption(supabase, id);
  if (!cap) return NextResponse.json({ caption: null });
  const { data: row, error } = await supabase.from('image_catalog').select('cloudinary_public_id, caption_overlay, formats:format_id (aspect_ratio)').eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message.includes('caption_overlay') ? CAPTION_MIGRATION : error.message }, { status: 500 });
  const overlay = readCaptionOverlay((row as any)?.caption_overlay);
  const { data: versions } = await supabase.from('image_catalog').select('id, caption_overlay').eq('variation_of', id).limit(500);
  if (cap.dog?.symbol || cap.cat?.symbol) await ensureSymbols().catch(() => null);
  const ratio = String((row as any)?.formats?.aspect_ratio || '2:3').split(':').map(Number);
  return NextResponse.json({
    caption: cap.caption, dog: cap.dog, cat: cap.cat, designAnimal: cap.designAnimal,
    applied: overlay?.applied ?? null,
    clean: overlay?.applied ? overlay.clean_public_id : (row as any)?.cloudinary_public_id,
    aspect: ratio[0] > 0 && ratio[1] > 0 ? ratio[0] / ratio[1] : 2 / 3,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    versions: { total: versions?.length ?? 0, captioned: (versions ?? []).filter((v: any) => readCaptionOverlay(v.caption_overlay)?.applied).length },
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  if (body.action !== 'apply' && body.action !== 'remove') return NextResponse.json({ error: 'Choose apply or remove' }, { status: 400 });
  try {
    const r = await captionDesignAndVersions(serviceClient(), id, body.action === 'apply', { versions: !!body.versions });
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not change the caption' }, { status: 500 });
  }
}
