/**
 * GET /api/public/search?q=&tag=&animal=dog|cat&breed=<slug>&pets=1|2&page=
 * One search box for the whole shop. Returns matching breeds and collections (to jump to)
 * and designs ranked by how well they match (collections, team nicknames and breed count most,
 * then tags, then descriptions), with synonyms ("xmas" finds Christmas). `tag` is the
 * "See more crown designs" link. Only public, listed catalogue designs.
 */
import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';
import { buildSearchQuery, cleanTag } from '@/lib/search/query';

export const dynamic = 'force-dynamic';
const PAGE = 24;

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const q = (sp.get('q') || '').slice(0, 100);
  const tag = cleanTag(sp.get('tag'));
  const animal = sp.get('animal') === 'dog' || sp.get('animal') === 'cat' ? sp.get('animal') : null;
  const page = Math.min(50, Math.max(0, Number(sp.get('page')) || 0));
  const pets = sp.get('pets') === '1' ? 1 : sp.get('pets') === '2' ? 2 : null;  // one pet / two or more
  const { tsquery, words } = buildSearchQuery(q, { prefix: sp.get('typing') === '1' });
  if (!tsquery && !tag) return NextResponse.json({ query: q, tag, breeds: [], collections: [], designs: [], total: 0, page });

  const supabase = serviceClient();
  try {
    let breedId: string | null = null;
    if (sp.get('breed')) {
      const { data: b } = await supabase.from('breeds').select('id').eq('slug', sp.get('breed')!.slice(0, 80)).maybeSingle();
      breedId = b?.id ?? null;
    }
    const like = words.length ? words.join(' ') : null;
    const [{ data: hits, error }, breeds, collections] = await Promise.all([
      supabase.rpc('search_designs', { p_query: tsquery, p_animal: animal, p_breed_id: breedId, p_tag: tag, p_limit: PAGE, p_offset: page * PAGE, p_pets: pets }),
      like && page === 0
        ? supabase.from('breeds').select('id, name, slug, animal_type').eq('is_active', true)
          .or(words.map(w => `name.ilike.%${w}%`).join(',')).order('popularity_rank', { ascending: true, nullsFirst: false }).limit(6)
        : Promise.resolve({ data: [] }),
      like && page === 0
        ? supabase.from('collections').select('name, short_name, path, kind, depth, search_terms').eq('is_active', true)
          .or([...words.map(w => `name.ilike.%${w}%`), ...words.map(w => `short_name.ilike.%${w}%`), `search_terms.ov.{${words.map(w => `"${w}"`).join(',')}}`].join(',')).order('depth').limit(8)
        : Promise.resolve({ data: [] }),
    ]);
    if (error) throw error;

    const ids = (hits ?? []).map((h: any) => h.id);
    const { data: rows } = ids.length
      ? await supabase.from('image_catalog')
        .select('id, description, public_url, cloudinary_public_id, image_variants, display_tags, like_count, share_count, breed_id, theme_id, format_id, subject_count, created_at, breeds!breed_id (id, name, slug, animal_type), formats!format_id (id, name)')
        .in('id', ids)
      : { data: [] };
    const byId = new Map((rows ?? []).map((r: any) => [r.id, r]));

    return NextResponse.json({
      query: q, tag, page, pageSize: PAGE,
      total: Number(hits?.[0]?.total ?? 0),
      breeds: (breeds as any).data ?? [],
      collections: ((collections as any).data ?? []).map((c: any) => ({ name: c.name, shortName: c.short_name, path: c.path, kind: c.kind })),
      designs: ids.map((id: string) => byId.get(id)).filter(Boolean),
    }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch (e) {
    console.error('search failed', e);
    return NextResponse.json({ error: 'Search is unavailable just now' }, { status: 500 });
  }
}
