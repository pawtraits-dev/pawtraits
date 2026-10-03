/**
 * Admin → Collections → Team versions, one design.
 * GET   — the teams it offers, each with its version (thumbnail) and status
 * PATCH { team_switch: 'league' | 'any' | 'off' } — which teams it offers
 * POST  { team: "<collection path>" } — make that team's version now (retries failed ones)
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { ensureTeamVariant, groupByLeague, teamContext } from '@/lib/collections/team-variants';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;
const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const supabase = serviceClient();
  try {
    const ctx = await teamContext(supabase, id);
    if (!ctx) return NextResponse.json({ error: 'Not a sports design' }, { status: 404 });
    const imageIds = ctx.teams.map(t => t.imageId).filter(Boolean) as string[];
    const { data: imgs } = imageIds.length ? await supabase.from('image_catalog').select('id, cloudinary_public_id, public_url').in('id', imageIds) : { data: [] };
    const cloud = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const thumbOf = new Map((imgs ?? []).map((r: any) => [r.id, cloud && r.cloudinary_public_id ? `https://res.cloudinary.com/${cloud}/image/upload/c_fill,w_160,h_200,g_auto/f_auto,q_auto/${r.cloudinary_public_id}` : r.public_url]));
    const { data: errors } = await supabase.from('design_team_variants').select('team_collection_id, error').eq('source_image_id', ctx.sourceId).eq('status', 'failed');
    const errorOf = new Map((errors ?? []).map((e: any) => [e.team_collection_id, e.error]));
    return NextResponse.json({
      scope: ctx.scope, home: ctx.homeTeamPath,
      groups: groupByLeague(ctx.teams).map(g => ({
        league: g.league, name: g.name,
        teams: g.teams.map(t => ({ path: t.path, name: t.name, short: t.short, colours: t.colours, status: t.status, imageId: t.imageId, thumb: t.imageId ? thumbOf.get(t.imageId) ?? null : null, error: errorOf.get(t.id) ?? null })),
      })),
    });
  } catch (e) {
    console.error('team versions GET failed', e);
    return NextResponse.json({ error: 'Could not load' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (!UUID.test(id) || !['league', 'any', 'off'].includes(body.team_switch)) return NextResponse.json({ error: 'Choose its league, any team or off' }, { status: 400 });
  const { error } = await serviceClient().from('image_catalog').update({ team_switch: body.team_switch === 'league' ? null : body.team_switch }).eq('id', id);
  if (error) return NextResponse.json({ error: 'Could not save' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (!UUID.test(id) || typeof body.team !== 'string') return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  try {
    const ctx = await teamContext(serviceClient(), id);
    const team = ctx?.teams.find(t => t.path === body.team);
    if (!ctx || !team) return NextResponse.json({ error: 'That team isn’t offered for this design' }, { status: 400 });
    const r = await ensureTeamVariant({ sourceId: ctx.sourceId, team, requestedBy: 'admin' });
    return NextResponse.json(r);
  } catch (e) {
    console.error('team version POST failed', e);
    return NextResponse.json({ status: 'failed', error: 'Something went wrong' }, { status: 500 });
  }
}
