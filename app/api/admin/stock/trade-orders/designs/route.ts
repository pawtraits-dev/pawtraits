/**
 * GET /api/admin/stock/trade-orders/designs?q=&page=&layout=&collection=&breed=&animal=&meta=1
 * Catalogue designs to add to a trade print order (listed, public designs; newest first).
 *   layout      portrait | landscape | square | wide   (the design's format: 2:3, 3:2, 1:1, 2:1)
 *   collection  a collection id (its sub-collections included)
 *   breed       a breed id (main pet or any pet in a multi-pet design)
 *   animal      dog | cat
 *   meta=1      also return the filter options (collections, breeds)
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { LISTED_ONLY } from '@/lib/catalog/listing';

export const dynamic = 'force-dynamic';
const PAGE = 36;
const UUID = /^[0-9a-f-]{36}$/i;
const LAYOUTS: Record<string, string> = { portrait: '2:3', landscape: '3:2', square: '1:1', wide: '2:1' };
const NONE = '00000000-0000-0000-0000-000000000000';

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const p = request.nextUrl.searchParams;
  const q = (p.get('q') || '').trim().replace(/[%,()]/g, '').slice(0, 60);
  const page = Math.max(0, Number(p.get('page')) || 0);
  const supabase = serviceClient();

  let query = supabase.from('image_catalog').select('id, description, cloudinary_public_id, public_url, breeds:breed_id (name), formats:format_id (aspect_ratio)', { count: 'exact' })
    .eq('is_public', true).or(LISTED_ONLY).not('is_customer_generated', 'is', true)
    .order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
  if (q) query = query.ilike('description', `%${q}%`);

  // Layout: designs whose format has that shape
  const layout = LAYOUTS[p.get('layout') || ''];
  if (layout) {
    const { data: formats } = await supabase.from('formats').select('id').eq('aspect_ratio', layout);
    query = query.in('format_id', (formats ?? []).map(f => f.id).concat(NONE));
  }

  // Collection (and the collections inside it)
  const collection = p.get('collection');
  if (collection && UUID.test(collection)) {
    const { data: col } = await supabase.from('collections').select('path').eq('id', collection).maybeSingle();
    const { data: under } = col ? await supabase.from('collections').select('id, path').like('path', `${col.path}%`) : { data: [] as any[] };
    const cols = (under ?? []).filter((c: any) => c.path === col!.path || c.path.startsWith(`${col!.path}/`));
    const { data: links } = cols.length
      ? await supabase.from('design_collections').select('image_id').in('collection_id', cols.map((c: any) => c.id)).eq('excluded', false).limit(5000)
      : { data: [] as any[] };
    query = query.in('id', Array.from(new Set((links ?? []).map((l: any) => l.image_id))).slice(0, 1000).concat(NONE));
  }

  // Breed: the main pet, or any pet of a multi-pet design
  const breed = p.get('breed');
  const animal = p.get('animal');
  let breedIds: string[] | null = null;
  if (breed && UUID.test(breed)) breedIds = [breed];
  else if (animal === 'dog' || animal === 'cat') {
    const { data: bs } = await supabase.from('breeds').select('id').eq('animal_type', animal);
    breedIds = (bs ?? []).map(b => b.id);
  }
  if (breedIds) {
    const ids = breedIds.length ? breedIds : [NONE];
    const { data: subs } = await supabase.from('image_catalog_subjects').select('image_catalog_id').in('breed_id', ids).limit(5000);
    const viaSubjects = Array.from(new Set((subs ?? []).map((s: any) => s.image_catalog_id))).slice(0, 800);
    query = viaSubjects.length
      ? query.or(`breed_id.in.(${ids.join(',')}),id.in.(${viaSubjects.join(',')})`)
      : query.in('breed_id', ids);
  }

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let meta: any = undefined;
  if (p.get('meta') === '1') {
    const [{ data: cols }, { data: breeds }] = await Promise.all([
      supabase.from('collections').select('id, path, name, depth, kind').eq('is_active', true).order('path'),
      supabase.from('breeds').select('id, name, animal_type').eq('is_active', true).order('name'),
    ]);
    meta = { collections: cols ?? [], breeds: breeds ?? [] };
  }

  const cloud = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const one = (v: any) => (Array.isArray(v) ? v[0] : v);
  return NextResponse.json({
    total: count ?? 0, page, pageSize: PAGE, meta,
    designs: (data ?? []).map((d: any) => ({
      id: d.id,
      title: (d.description || '').match(/\*\*(.+?)\*\*/)?.[1]?.trim() || 'Untitled design',
      breed: one(d.breeds)?.name ?? null,
      ratio: one(d.formats)?.aspect_ratio ?? null,
      thumb: d.cloudinary_public_id && cloud ? `https://res.cloudinary.com/${cloud}/image/upload/c_fill,w_160,h_200,g_auto/f_auto,q_auto/${d.cloudinary_public_id}` : d.public_url,
    })),
  });
}
