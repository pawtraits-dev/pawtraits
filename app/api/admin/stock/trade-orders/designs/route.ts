/**
 * GET /api/admin/stock/trade-orders/designs?q=&page=&layout=&collection=&breed=&animal=&meta=1
 * Catalogue designs to add to a trade print order (listed, public designs; newest first).
 *   layout      portrait | landscape | square | wide   (the design's format: 2:3, 3:2, 1:1, 2:1)
 *   collection  a collection id (its sub-collections included)
 *   breed       a breed id (main pet or any pet in a multi-pet design)
 *   animal      dog | cat
 *   origin      all (default) | uploads | versions   (as Admin → Catalogue: lib/catalog/originals.ts)
 *   ordered     no | yes   on a trade order (not cancelled, drafts included) or not; a design counts
 *               as ordered when it or any of its versions is (range coverage)
 *   meta=1      also return the filter options (collections, breeds)
 * Breed / coat variations (image_catalog.variation_of) are shown under their reference design
 * (each design has a `versions` count; GET ./designs/[id]/versions lists them, with its team
 * versions). With a breed or dog/cat filter they're listed in the grid too, so a Labrador
 * filter finds the Labrador versions. origin=uploads: original designs only (versions still open
 * from each design's count); origin=versions: only versions, listed in the grid.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { LISTED_ONLY } from '@/lib/catalog/listing';
import { onlyOriginals, onlyVersions } from '@/lib/catalog/originals';

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

  // Every filter is applied to `query`; with the ordered filter, ids are matched first (below)
  const ordered = p.get('ordered') === 'no' || p.get('ordered') === 'yes' ? p.get('ordered') : null;
  const SELECT = 'id, description, cloudinary_public_id, public_url, variation_of, breeds:breed_id (name), formats:format_id (aspect_ratio)';
  let query = supabase.from('image_catalog').select(ordered ? 'id, variation_of' : SELECT, ordered ? {} : { count: 'exact' })
    .eq('is_public', true).or(LISTED_ONLY).not('is_customer_generated', 'is', true)
    .order('created_at', { ascending: false });
  if (!ordered) query = query.range(page * PAGE, page * PAGE + PAGE - 1);
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

  // Uploads or variations (as Admin → Catalogue). Default: uploads with their versions grouped
  // under them, versions listed too once filtered by breed or dog/cat
  const origin = p.get('origin');
  if (origin === 'uploads') query = onlyOriginals(query);
  else if (origin === 'versions') query = onlyVersions(query);
  else if (!breedIds) query = query.is('variation_of', null);

  let data: any[] | null, count: number | null, error: any;
  if (!ordered) {
    ({ data, count, error } = await query as any);
  } else {
    // On a trade order: every line of an order that isn't cancelled; a version on an order covers
    // the design it was made from too
    const onOrder = new Set<string>();
    const { data: live } = await supabase.from('trade_print_orders').select('id').neq('status', 'cancelled').limit(1000);
    const orderIds = (live ?? []).map((o: any) => o.id);
    for (let i = 0; i < orderIds.length; i += 100) {
      for (let from = 0; ; from += 1000) {
        const { data: ls } = await supabase.from('trade_print_order_lines').select('image_id').in('order_id', orderIds.slice(i, i + 100)).range(from, from + 999);
        for (const l of ls ?? []) onOrder.add(l.image_id);
        if (!ls || ls.length < 1000) break;
      }
    }
    const lineIds = Array.from(onOrder);
    for (let i = 0; i < lineIds.length; i += 200) {
      const { data: vs } = await supabase.from('image_catalog').select('variation_of').in('id', lineIds.slice(i, i + 200)).not('variation_of', 'is', null);
      for (const v of vs ?? []) onOrder.add(v.variation_of);
    }
    // All matching designs (ids only), then the page of the ones on / not on an order
    const matched: any[] = [];
    for (let from = 0; from < 20_000; from += 1000) {
      const { data: chunk, error: e } = await (query as any).range(from, from + 999);
      if (e) { error = e; break; }
      matched.push(...(chunk ?? []));
      if (!chunk || chunk.length < 1000) break;
    }
    const keep = matched.filter((d: any) => (ordered === 'yes') === (onOrder.has(d.id) || (!!d.variation_of && onOrder.has(d.variation_of))));
    count = keep.length;
    const pageIds = keep.slice(page * PAGE, page * PAGE + PAGE).map((d: any) => d.id);
    if (!error) {
      const r = pageIds.length ? await supabase.from('image_catalog').select(SELECT).in('id', pageIds) : { data: [] as any[], error: null };
      error = r.error;
      const pos = new Map(pageIds.map((id, i) => [id, i]));
      data = (r.data ?? []).sort((a: any, b: any) => (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0));
    } else data = null;
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // How many versions each design has: breed / coat variations and finished team versions
  const ids = (data ?? []).map((d: any) => d.id);
  const versions = new Map<string, number>();
  if (ids.length) {
    const [{ data: vars }, { data: teams }] = await Promise.all([
      supabase.from('image_catalog').select('variation_of').in('variation_of', ids).not('is_customer_generated', 'is', true),
      supabase.from('design_team_variants').select('source_image_id').in('source_image_id', ids).eq('status', 'done').not('image_id', 'is', null),
    ]);
    for (const v of vars ?? []) versions.set(v.variation_of, (versions.get(v.variation_of) ?? 0) + 1);
    for (const t of teams ?? []) versions.set(t.source_image_id, (versions.get(t.source_image_id) ?? 0) + 1);
  }

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
      versions: versions.get(d.id) ?? 0,
      variationOf: d.variation_of ?? null,
      title: (d.description || '').match(/\*\*(.+?)\*\*/)?.[1]?.trim() || 'Untitled design',
      breed: one(d.breeds)?.name ?? null,
      ratio: one(d.formats)?.aspect_ratio ?? null,
      thumb: d.cloudinary_public_id && cloud ? `https://res.cloudinary.com/${cloud}/image/upload/c_fill,w_160,h_200,g_auto/f_auto,q_auto/${d.cloudinary_public_id}` : d.public_url,
    })),
  });
}
