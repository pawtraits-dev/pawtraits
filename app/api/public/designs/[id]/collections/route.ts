/**
 * GET /api/public/designs/[id]/collections — the collections a design is in (most specific
 * first, e.g. "Kansas City Chiefs" before "NFL") and its tags, for the chips on the design page.
 */
import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ collections: [], tags: [] });
  const supabase = serviceClient();
  try {
    const { data: design } = await supabase.from('image_catalog').select('id, display_tags, is_public, is_customer_generated').eq('id', id).maybeSingle();
    if (!design || !design.is_public || design.is_customer_generated) return NextResponse.json({ collections: [], tags: [] });
    const { data: links } = await supabase.from('design_collections')
      .select('collections!inner (name, short_name, path, kind, depth, is_active)').eq('image_id', id).eq('excluded', false);
    const collections = (links ?? []).map((l: any) => l.collections).filter((c: any) => c?.is_active)
      .sort((a: any, b: any) => b.depth - a.depth)
      .map((c: any) => ({ name: c.name, shortName: c.short_name, path: c.path, kind: c.kind }));
    return NextResponse.json({ collections, tags: (design.display_tags ?? []).slice(0, 8) },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
  } catch (e) {
    console.error('design collections failed', e);
    return NextResponse.json({ collections: [], tags: [] });
  }
}
