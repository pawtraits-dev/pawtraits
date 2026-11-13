/**
 * Admin → Catalogue → a design → Framed card (lib/frames/).
 * GET     the design's card (dog and cat wording), whether the frame is on, previews of both shapes
 * POST    { versions?: true }  frame on (or redrawn with the current wording), and on its versions
 * DELETE  ?versions=1          frame off (and off its versions)
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { FRAME_SHAPES, frameBaseForWidth, frameCrop, frameLayers, readFrameOverlay } from '@/lib/frames/frame';
import { FRAME_MIGRATION, designCard, ensureFrameAssets, frameDesignAndVersions } from '@/lib/frames/server';
import { readCaptionOverlay } from '@/lib/captions/caption';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const supabase = serviceClient();
  const found = await designCard(supabase, id);
  if (!found) return NextResponse.json({ card: null });
  const { data: row, error } = await supabase.from('image_catalog').select('cloudinary_public_id, caption_overlay, frame_overlay').eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ error: /frame_overlay/.test(error.message) ? FRAME_MIGRATION : error.message }, { status: 500 });
  const frame = readFrameOverlay((row as any)?.frame_overlay);
  const plate = readCaptionOverlay((row as any)?.caption_overlay);
  const clean: string | null = frame?.clean_public_id ?? (plate?.applied ? plate.clean_public_id : (row as any)?.cloudinary_public_id ?? null);
  const { data: versions } = await supabase.from('image_catalog').select('id, frame_overlay').eq('variation_of', id).limit(500);
  await ensureFrameAssets().catch(e => console.warn('frame files upload failed', e));
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const previews = found.card && clean && cloudName
    ? Object.fromEntries(FRAME_SHAPES.map(s => { const b = frameBaseForWidth(s, 400); return [s, `https://res.cloudinary.com/${cloudName}/image/upload/${frameCrop(b)}/${frameLayers(found.card!, s, b)}/f_jpg,q_80/${clean}`]; }))
    : null;
  return NextResponse.json({
    kind: found.kind, card: found.card, dog: found.dog, cat: found.cat, designAnimal: found.designAnimal,
    applied: frame?.applied ?? null, plateOn: !!plate?.applied, previews,
    versions: { total: versions?.length ?? 0, framed: (versions ?? []).filter((v: any) => readFrameOverlay(v.frame_overlay)?.applied).length },
  });
}

async function run(id: string, on: boolean, versions: boolean) {
  try {
    const r = await frameDesignAndVersions(serviceClient(), id, on, { versions });
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not change the frame' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  return run(id, true, !!body.versions);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return run(id, false, new URL(request.url).searchParams.get('versions') === '1');
}
