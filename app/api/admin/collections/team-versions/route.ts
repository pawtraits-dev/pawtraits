/**
 * GET /api/admin/collections/team-versions?q=&page=
 * Admin → Collections → Team versions: every sports design (filed under a team or league) with
 * its team, which teams it offers (its league / any / off) and how many versions are made.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { VARIANT_TAG } from '@/lib/collections/team-variants';

export const dynamic = 'force-dynamic';
const PAGE = 20;

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const page = Math.max(0, Number(request.nextUrl.searchParams.get('page')) || 0);
  const q = (request.nextUrl.searchParams.get('q') || '').trim().toLowerCase().slice(0, 60);
  const supabase = serviceClient();
  try {
    const { data: sport } = await supabase.from('collections').select('id, path, name, depth, metadata').eq('kind', 'sport').gte('depth', 1).eq('is_active', true);
    const byId = new Map<string, any>((sport ?? []).map((c: any) => [c.id, c]));
    const teams = (sport ?? []).filter((c: any) => c.depth === 2 && c.metadata?.recolour_prompt);
    const { data: links } = byId.size
      ? await supabase.from('design_collections').select('image_id, collection_id').in('collection_id', Array.from(byId.keys())).eq('excluded', false).limit(5000)
      : { data: [] };
    const homeOf = new Map<string, any>();
    for (const l of links ?? []) {
      const c = byId.get(l.collection_id);
      const cur = homeOf.get(l.image_id);
      if (!cur || c.depth > cur.depth) homeOf.set(l.image_id, c);
    }
    const ids = Array.from(homeOf.keys());
    const { data: rows } = ids.length
      ? await supabase.from('image_catalog').select('id, description, cloudinary_public_id, public_url, tags, team_switch, is_public, created_at').in('id', ids)
      : { data: [] };
    const designs = (rows ?? []).filter((r: any) => !(r.tags ?? []).includes(VARIANT_TAG))
      .map((r: any) => {
        const home = homeOf.get(r.id);
        const league = home.path.split('/')[1];
        const offered = r.team_switch === 'off' ? 0 : r.team_switch === 'any' ? teams.length : teams.filter((t: any) => t.path.split('/')[1] === league).length;
        const title = (/^\*\*(.+?)\*\*/.exec(r.description || '')?.[1] || (r.description || '').replace(/\*\*/g, '')).slice(0, 80) || 'Untitled design';
        return { id: r.id, title, thumb: thumb(r), home: { path: home.path, name: home.name, isTeam: home.depth === 2 }, league, scope: r.team_switch ?? 'league', offered, isPublic: r.is_public !== false, created: r.created_at };
      })
      .filter((d: any) => !q || d.title.toLowerCase().includes(q) || d.home.name.toLowerCase().includes(q))
      .sort((a: any, b: any) => (a.created < b.created ? 1 : -1));
    const pageRows = designs.slice(page * PAGE, page * PAGE + PAGE);
    const { data: variants } = pageRows.length
      ? await supabase.from('design_team_variants').select('source_image_id, status').in('source_image_id', pageRows.map((d: any) => d.id))
      : { data: [] };
    const tally = (id: string, s: string) => (variants ?? []).filter((v: any) => v.source_image_id === id && v.status === s).length;
    return NextResponse.json({
      total: designs.length, page, pageSize: PAGE,
      designs: pageRows.map((d: any) => ({ ...d, made: tally(d.id, 'done') + (d.home.isTeam && d.offered ? 1 : 0), failed: tally(d.id, 'failed') })),
    });
  } catch (e) {
    console.error('team versions list failed', e);
    return NextResponse.json({ error: 'Could not load sports designs' }, { status: 500 });
  }
}

function thumb(row: any): string {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  return cloud && row.cloudinary_public_id ? `https://res.cloudinary.com/${cloud}/image/upload/c_fill,w_200,h_200,g_auto/f_auto,q_auto/${row.cloudinary_public_id}` : row.public_url;
}
