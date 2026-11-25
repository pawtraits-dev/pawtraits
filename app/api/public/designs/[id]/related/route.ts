/**
 * GET /api/public/designs/[id]/related: for "More like this" on the design page.
 * Returns { versions, breed }: other versions of the same design (its parent, its siblings and its
 * own versions), then designs of the same breed. Listed, public designs only; never the design itself.
 * Three small queries, none per row. Nothing here is admin data.
 */
import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';
import { LISTED_ONLY } from '@/lib/catalog/listing';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f-]{36}$/i;
const COLUMNS = 'id, description, public_url, subjects';
const BREED_LIMIT = 24;
const VERSION_LIMIT = 12;

const shape = (r: any) => ({
  id: r.id as string,
  description: (r.description ?? undefined) as string | undefined,
  public_url: (r.public_url ?? undefined) as string | undefined,
  subject_count: Array.isArray(r.subjects) && r.subjects.length ? r.subjects.length : 1,
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const empty = { versions: [], breed: [] };
  if (!UUID.test(id)) return NextResponse.json(empty);
  const supabase = serviceClient();
  try {
    const { data: design } = await supabase.from('image_catalog').select('id, breed_id, variation_of, is_public').eq('id', id).maybeSingle();
    if (!design || !design.is_public) return NextResponse.json(empty);

    // Other versions of the same design: its parent, the parent's other versions, and its own versions
    const parent: string | null = design.variation_of ?? null;
    const links = [`variation_of.eq.${id}`, ...(parent ? [`id.eq.${parent}`, `variation_of.eq.${parent}`] : [])].join(',');
    const versionsQ = supabase.from('image_catalog').select(COLUMNS)
      .eq('is_public', true).eq('is_customer_generated', false).or(LISTED_ONLY).or(links).neq('id', id)
      .order('created_at', { ascending: false }).limit(VERSION_LIMIT);
    const breedQ = design.breed_id
      ? supabase.from('image_catalog').select(COLUMNS)
          .eq('is_public', true).eq('is_customer_generated', false).or(LISTED_ONLY).eq('breed_id', design.breed_id).neq('id', id)
          .order('created_at', { ascending: false }).limit(BREED_LIMIT)
      : null;
    const [versions, breed] = await Promise.all([versionsQ, breedQ]);
    return NextResponse.json(
      { versions: (versions.data ?? []).map(shape), breed: (breed?.data ?? []).map(shape) },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
    );
  } catch (e) {
    console.error('design related failed', e);
    return NextResponse.json(empty);
  }
}
