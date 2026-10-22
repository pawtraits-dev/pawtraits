/**
 * GET /api/admin/stock/trade-orders/designs/[id]/versions
 *   → { design: { id, title, thumb }, versions: [{ id, title, label, kind, thumb, hidden }] }
 * Every version of a design that can be printed for the stall: breed / coat variations
 * (image_catalog.variation_of) and finished team versions (design_team_variants), hidden
 * (unpublished) ones included and marked.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(_r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const supabase = serviceClient();
  const cloud = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const thumb = (r: any) => (r.cloudinary_public_id && cloud ? `https://res.cloudinary.com/${cloud}/image/upload/c_fill,w_160,h_200,g_auto/f_auto,q_auto/${r.cloudinary_public_id}` : r.public_url);
  const titleOf = (desc?: string | null) => (desc || '').match(/\*\*(.+?)\*\*/)?.[1]?.trim() || 'Untitled design';
  const one = (v: any) => (Array.isArray(v) ? v[0] : v);
  const FIELDS = 'id, description, cloudinary_public_id, public_url, is_public, breeds:breed_id (name), coats:coat_id (name), outfits:outfit_id (name)';

  const [{ data: design }, { data: vars }, { data: teams }] = await Promise.all([
    supabase.from('image_catalog').select(FIELDS).eq('id', id).maybeSingle(),
    supabase.from('image_catalog').select(FIELDS).eq('variation_of', id).not('is_customer_generated', 'is', true).order('created_at'),
    supabase.from('design_team_variants').select('image_id, collections:team_collection_id (name, short_name)').eq('source_image_id', id).eq('status', 'done').not('image_id', 'is', null),
  ]);
  if (!design) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const teamIds = (teams ?? []).map((t: any) => t.image_id);
  const { data: teamRows } = teamIds.length ? await supabase.from('image_catalog').select(FIELDS).in('id', teamIds) : { data: [] as any[] };
  const teamById = new Map((teamRows ?? []).map((r: any) => [r.id, r]));
  const label = (r: any) => [one(r.breeds)?.name, one(r.coats)?.name, one(r.outfits)?.name].filter(Boolean).join(' · ') || null;

  return NextResponse.json({
    design: { id: design.id, title: titleOf(design.description), thumb: thumb(design), label: label(design) },
    versions: [
      ...(vars ?? []).map((r: any) => ({ id: r.id, title: titleOf(r.description), label: label(r) ?? 'Variation', kind: 'variation', thumb: thumb(r), hidden: r.is_public === false })),
      ...(teams ?? []).map((t: any) => {
        const r = teamById.get(t.image_id);
        const c = one(t.collections);
        return r ? { id: r.id, title: titleOf(r.description), label: c?.short_name || c?.name || 'Team version', kind: 'team', thumb: thumb(r), hidden: false } : null;
      }).filter(Boolean),
    ],
  });
}
