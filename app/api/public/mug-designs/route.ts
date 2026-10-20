/**
 * GET /api/public/mug-designs → { designs: [{ id, title, imageUrl, teams, personalised }] }
 * Catalogue designs made for mugs (2:1 wraparound format, e.g. the football designs), for the
 * /mugs page alongside the zodiac mugs. Listed, public designs only: team versions and other
 * link-only designs are left out (customers reach them through the team picker).
 */
import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';
import { LISTED_ONLY } from '@/lib/catalog/listing';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = serviceClient();
    const { data: formats } = await supabase.from('formats').select('id').eq('aspect_ratio', '2:1');
    const formatIds = (formats ?? []).map(f => f.id);
    if (!formatIds.length) return NextResponse.json({ designs: [] });

    const { data: rows, error } = await supabase.from('image_catalog')
      .select('id, description, team_switch, is_featured, created_at')
      .in('format_id', formatIds).eq('is_public', true).or(LISTED_ONLY)
      .not('is_customer_generated', 'is', true)
      .order('is_featured', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })
      .limit(60);
    if (error) throw error;
    const ids = (rows ?? []).map(r => r.id);

    // Which are sports designs (team picker) and which have the shirt name and number
    const [{ data: links }, { data: kits }] = await Promise.all([
      ids.length ? supabase.from('design_collections').select('image_id, collections!inner (kind, depth)').in('image_id', ids).eq('excluded', false) : Promise.resolve({ data: [] as any[] }),
      ids.length ? supabase.from('image_catalog').select('id, kit_personalisation').in('id', ids) : Promise.resolve({ data: [] as any[] }),
    ]);
    const sport = new Set((links ?? []).filter((l: any) => l.collections?.kind === 'sport').map((l: any) => l.image_id));
    const kit = new Set((kits ?? []).filter((k: any) => k.kit_personalisation?.name).map((k: any) => k.id));

    return NextResponse.json({
      designs: (rows ?? []).map(r => ({
        id: r.id,
        title: (r.description || '').match(/\*\*(.+?)\*\*/)?.[1]?.trim() || 'Pawtraits mug',
        imageUrl: `/api/secure-images/${r.id}?variant=mid_size&w=800`,   // same (watermarked) route as Browse
        teams: sport.has(r.id) && r.team_switch !== 'off',
        personalised: kit.has(r.id),
      })),
    });
  } catch (e) {
    console.error('mug designs failed', e);
    return NextResponse.json({ designs: [] });
  }
}
