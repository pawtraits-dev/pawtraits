/**
 * Divider cards for the stall's flip-through bins (lib/stock/divider-cards.ts).
 * GET              breeds to choose from: name, dog/cat, hero picture, number of public designs
 * GET ?breed=<id>  that breed's public designs (newest first) and the three on its card
 * PATCH { breedId, designIds }  choose the card's designs (saved in breeds.metadata.divider_designs;
 *                  an empty list goes back to the newest three)
 * POST  { size: 'S'|'M'|'L'|'XL', breedIds: string[] }  → PDF, one card per page at its exact size
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { LISTED_ONLY } from '@/lib/catalog/listing';
import { DESIGNS_PER_CARD, DIVIDER_SIZES, generateDividerCards, type DividerSize } from '@/lib/stock/divider-cards';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const UUID = /^[0-9a-f-]{36}$/i;
const cloud = () => process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const title = (d: string | null) => (d || '').match(/\*\*(.+?)\*\*/)?.[1]?.trim() || (d || '').replace(/[#*_]/g, '').trim().slice(0, 60) || 'Untitled design';

/** A breed's public, listed designs, newest first */
async function breedDesigns(breedId: string, limit = 120) {
  const { data } = await serviceClient().from('image_catalog').select('id, description, cloudinary_public_id, created_at')
    .eq('breed_id', breedId).eq('is_public', true).or(LISTED_ONLY).not('is_customer_generated', 'is', true)
    .not('cloudinary_public_id', 'is', null).order('created_at', { ascending: false }).limit(limit);
  return (data ?? []) as { id: string; description: string | null; cloudinary_public_id: string; created_at: string }[];
}

/** The card's designs: the chosen ones still available, topped up with the newest */
function cardDesigns(all: { id: string }[], chosen: unknown): string[] {
  const ids = new Set(all.map(d => d.id));
  const picked = (Array.isArray(chosen) ? chosen : []).filter((x): x is string => typeof x === 'string' && ids.has(x));
  for (const d of all) { if (picked.length >= DESIGNS_PER_CARD) break; if (!picked.includes(d.id)) picked.push(d.id); }
  return picked.slice(0, DESIGNS_PER_CARD);
}

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const supabase = serviceClient();
  const breedId = request.nextUrl.searchParams.get('breed');

  if (breedId) {
    if (!UUID.test(breedId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const [{ data: breed }, all] = await Promise.all([supabase.from('breeds').select('metadata').eq('id', breedId).maybeSingle(), breedDesigns(breedId)]);
    const chosen = (breed as any)?.metadata?.divider_designs;
    return NextResponse.json({
      designs: all.map(d => ({ id: d.id, title: title(d.description), at: d.created_at, thumb: cloud() ? `https://res.cloudinary.com/${cloud()}/image/upload/c_fill,w_160,h_240,g_auto/f_auto,q_auto/${d.cloudinary_public_id}` : null })),
      selected: cardDesigns(all, chosen),
      custom: Array.isArray(chosen) && chosen.length > 0,
    });
  }

  const { data: breeds, error } = await supabase.from('breeds').select('id, name, animal_type, hero_image_url, metadata').eq('is_active', true).order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const counts = new Map<string, number>();
  for (let from = 0; from < 20_000; from += 1000) {
    const { data } = await supabase.from('image_catalog').select('breed_id').eq('is_public', true).or(LISTED_ONLY).not('breed_id', 'is', null).range(from, from + 999);
    for (const r of data ?? []) counts.set(r.breed_id, (counts.get(r.breed_id) ?? 0) + 1);
    if (!data || data.length < 1000) break;
  }
  return NextResponse.json({
    sizes: Object.entries(DIVIDER_SIZES).map(([key, v]) => ({ key, label: v.label })),
    breeds: (breeds ?? []).map((b: any) => ({ id: b.id, name: b.name, animal: b.animal_type, hero: b.hero_image_url, designs: counts.get(b.id) ?? 0, custom: Array.isArray(b.metadata?.divider_designs) && b.metadata.divider_designs.length > 0 })),
  });
}

export async function PATCH(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  const breedId = String(body.breedId || '');
  if (!UUID.test(breedId)) return NextResponse.json({ error: 'Choose a breed' }, { status: 400 });
  const ids: string[] = Array.isArray(body.designIds) ? body.designIds.filter((x: any) => typeof x === 'string' && UUID.test(x)).slice(0, DESIGNS_PER_CARD) : [];
  const supabase = serviceClient();
  const { data: breed } = await supabase.from('breeds').select('metadata').eq('id', breedId).maybeSingle();
  if (!breed) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const metadata = { ...((breed as any).metadata ?? {}) };
  if (ids.length) metadata.divider_designs = ids; else delete metadata.divider_designs;
  const { error } = await supabase.from('breeds').update({ metadata }).eq('id', breedId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  const size = String(body.size || 'S').toUpperCase() as DividerSize;
  if (!(size in DIVIDER_SIZES)) return NextResponse.json({ error: 'Choose a size' }, { status: 400 });
  const ids: string[] = Array.isArray(body.breedIds) ? body.breedIds.filter((x: any) => typeof x === 'string').slice(0, 200) : [];
  if (!ids.length) return NextResponse.json({ error: 'Choose at least one breed' }, { status: 400 });
  const { data, error } = await serviceClient().from('breeds').select('id, name, animal_type, description, hero_image_url, metadata').in('id', ids).order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  try {
    const breeds = await Promise.all((data ?? []).map(async (b: any) => {
      const all = await breedDesigns(b.id);
      const byId = new Map(all.map(d => [d.id, d]));
      return {
        id: b.id, name: b.name, animal: (b.animal_type === 'cat' ? 'cat' : 'dog') as 'dog' | 'cat', description: b.description, heroUrl: b.hero_image_url,
        designs: cardDesigns(all, b.metadata?.divider_designs).map(id => ({ id, imageUrl: `https://res.cloudinary.com/${cloud()}/image/upload/c_limit,w_1600/f_jpg,q_90/${byId.get(id)!.cloudinary_public_id}` })),
      };
    }));
    const { pdf, missingHero } = await generateDividerCards(breeds, size);
    const name = ids.length === 1 && data?.[0] ? `divider-${data[0].name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${size}.pdf` : `divider-cards-${size}-${ids.length}.pdf`;
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${name}"`,
        ...(missingHero.length ? { 'X-Missing-Hero': encodeURIComponent(missingHero.join(', ')).slice(0, 1500) } : {}),
      },
    });
  } catch (e: any) {
    console.error('divider cards failed', e);
    return NextResponse.json({ error: e?.message || 'Could not make the cards' }, { status: 500 });
  }
}
