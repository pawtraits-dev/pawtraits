/**
 * Admin → Collections → Captions: the wording on the caption plate for every Pawsonality type and
 * Zodiac sign (lib/captions/), dog and cat versions.
 * GET    rows: defaults (quiz names and taglines; zodiac taglines), admin wording, a sample picture
 * PATCH  { collectionId, wording: { title_dog?, title_cat?, tagline_dog?, tagline_cat? } }
 *        ('' = no tagline, null = back to the default)
 * POST   { collectionId, on: boolean, what?: 'plate' | 'frame' }  plate (default) or frame on
 *        (redrawn with the current wording) or off for every design in that type/sign/card; stops
 *        after ~4½ minutes and reports what's left
 * POST   { kind: 'zodiac' | 'tarot' }  the frame on every design in every sign (or card) that has none
 *        yet; press again until `left` is 0
 * Changing the wording does not redraw anything by itself (as for the plate): press "Redraw frames".
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { readCaptionOverlay } from '@/lib/captions/caption';
import { readFrameOverlay } from '@/lib/frames/frame';
import { cardFromRow, ensureFrameAssets, frameAllInCollections, frameMany } from '@/lib/frames/server';
import { captionMany, captionRows, ensureSymbols, rowCaption, saveWording } from '@/lib/captions/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const UUID = /^[0-9a-f-]{36}$/i;

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const supabase = serviceClient();
  try {
    const rows = await captionRows(supabase, true);
    await ensureSymbols().catch((e) => console.warn('zodiac symbols upload failed', e));
    // A sample picture per row (the hero, else its newest design), without the plate
    const ids = rows.map(r => r.heroImageId).filter(Boolean) as string[];
    const { data: links } = await supabase.from('design_collections').select('collection_id, image_id, created_at').in('collection_id', rows.map(r => r.id)).order('created_at', { ascending: false }).limit(2000);
    const firstOf = new Map<string, string>();
    for (const l of links ?? []) if (!firstOf.has(l.collection_id)) firstOf.set(l.collection_id, l.image_id);
    const sampleIds = Array.from(new Set([...ids, ...Array.from(firstOf.values())]));
    const { data: imgs } = sampleIds.length ? await supabase.from('image_catalog').select('id, cloudinary_public_id, breeds:breed_id (animal_type), formats:format_id (aspect_ratio)').in('id', sampleIds) : { data: [] as any[] };
    const { data: caps } = sampleIds.length ? await supabase.from('image_catalog').select('id, caption_overlay').in('id', sampleIds) : { data: [] as any[] };
    const capOf = new Map((caps ?? []).map((c: any) => [c.id, readCaptionOverlay(c.caption_overlay)]));
    const { data: on } = await supabase.from('design_collections').select('collection_id, image_catalog!inner (caption_overlay)').in('collection_id', rows.map(r => r.id)).not('image_catalog.caption_overlay', 'is', null).limit(5000);
    const onCount = new Map<string, number>();
    for (const l of (on ?? []) as any[]) if (readCaptionOverlay(l.image_catalog?.caption_overlay)?.applied) onCount.set(l.collection_id, (onCount.get(l.collection_id) ?? 0) + 1);
    // Frames (tolerates the migration not being run yet)
    const { data: fr, error: frErr } = sampleIds.length ? await supabase.from('image_catalog').select('id, frame_overlay').in('id', sampleIds) : { data: [] as any[], error: null };
    const frameOf = new Map((frErr ? [] : fr ?? []).map((c: any) => [c.id, readFrameOverlay(c.frame_overlay)]));
    const { data: fon, error: fonErr } = await supabase.from('design_collections').select('collection_id, image_catalog!inner (frame_overlay)').in('collection_id', rows.map(r => r.id)).not('image_catalog.frame_overlay', 'is', null).limit(5000);
    const framedCount = new Map<string, number>();
    if (!fonErr) for (const l of (fon ?? []) as any[]) if (readFrameOverlay(l.image_catalog?.frame_overlay)?.applied) framedCount.set(l.collection_id, (framedCount.get(l.collection_id) ?? 0) + 1);
    if (rows.some(r => r.kind !== 'pawsonality')) await ensureFrameAssets().catch((e) => console.warn('frame files upload failed', e));
    const imgOf = new Map((imgs ?? []).map((i: any) => [i.id, i]));
    return NextResponse.json({
      cloudName: process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
      rows: rows.map(r => {
        const img: any = imgOf.get(r.heroImageId ?? '') ?? imgOf.get(firstOf.get(r.id) ?? '');
        const ratio = String(img?.formats?.aspect_ratio || '2:3').split(':').map(Number);
        const o = img ? capOf.get(img.id) : null;
        const f = img ? frameOf.get(img.id) : null;
        return {
          ...r, captioned: onCount.get(r.id) ?? 0, framed: framedCount.get(r.id) ?? 0,
          dog: rowCaption(r, 'dog'), cat: rowCaption(r, 'cat'),
          hasFrame: r.kind !== 'pawsonality', dogCard: cardFromRow(r, 'dog'), catCard: cardFromRow(r, 'cat'),
          sample: img ? { id: img.id, publicId: f?.applied ? f.clean_public_id : o?.applied ? o.clean_public_id : img.cloudinary_public_id, animal: img.breeds?.animal_type === 'cat' ? 'cat' : 'dog', aspect: ratio[0] > 0 && ratio[1] > 0 ? ratio[0] / ratio[1] : 2 / 3 } : null,
        };
      }),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not load the captions' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  if (!UUID.test(String(body.collectionId || ''))) return NextResponse.json({ error: 'Choose a type or sign' }, { status: 400 });
  try {
    await saveWording(serviceClient(), body.collectionId, body.wording ?? {});
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not save' }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  const supabase = serviceClient();
  if (body.kind === 'zodiac' || body.kind === 'tarot') {
    try {
      const rows = (await captionRows(supabase, true)).filter(r => r.kind === body.kind);
      const r = await frameAllInCollections(supabase, rows.map(x => x.id), Date.now() + 270_000);
      return NextResponse.json({ ok: true, ...r });
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Could not put the frames on' }, { status: 500 });
    }
  }
  if (!UUID.test(String(body.collectionId || ''))) return NextResponse.json({ error: 'Choose a type, sign or card' }, { status: 400 });
  const { data: links, error } = await supabase.from('design_collections').select('image_id').eq('collection_id', body.collectionId).limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  try {
    const ids = (links ?? []).map((l: any) => l.image_id);
    const r = body.what === 'frame'
      ? await frameMany(supabase, ids, !!body.on, Date.now() + 270_000)
      : await captionMany(supabase, ids, !!body.on, Date.now() + 270_000);
    return NextResponse.json({ ok: true, total: links?.length ?? 0, ...r });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not change the captions' }, { status: 500 });
  }
}
