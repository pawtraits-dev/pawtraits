/**
 * Team switcher on the design page (docs/specs/collections-plan.md, phase 4).
 *
 * GET  /api/public/designs/[id]/teams
 *   → { switchable, sourceId, current, groups: [{ league, name, teams: [{ path, name, short, nicknames, colours, ready, imageId }] }] }
 *   Works for an original sports design and for any of its team versions.
 * POST /api/public/designs/[id]/teams { team: "<collection path>", peek? }
 *   → { status: 'done', imageId } | { status: 'pending' } | { status: 'failed' } | { status: 'unavailable', reason }
 *   Ready versions come straight back. Otherwise starts painting (20–60 s; waits when it started
 *   it, 'pending' if someone else did). `peek: true` never starts anything (polling).
 *   New versions per visitor are capped per hour (setting team_switch_hourly_limit).
 */
import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';
import { getSetting } from '@/lib/app-settings';
import { getClientIp } from '@/lib/public-rate-limiter';
import { hashIp } from '@/lib/quiz/server';
import { ensureTeamVariant, groupByLeague, peekTeamVariant, teamContext } from '@/lib/collections/team-variants';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;
const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const off = { switchable: false, groups: [] };
  if (!UUID.test(id)) return NextResponse.json(off);
  try {
    if (!(await getSetting('team_switch_enabled'))) return NextResponse.json(off);
    const ctx = await teamContext(serviceClient(), id);
    if (!ctx || ctx.scope === 'off' || ctx.teams.length < 2) return NextResponse.json(off);
    const current = ctx.teams.find(t => t.path === ctx.currentTeamPath) ?? null;
    return NextResponse.json({
      switchable: true, sourceId: ctx.sourceId,
      current: current ? { path: current.path, name: current.name, short: current.short, colours: current.colours } : null,
      groups: groupByLeague(ctx.teams).map(g => ({
        league: g.league, name: g.name,
        teams: g.teams.map(t => ({ path: t.path, name: t.name, short: t.short, nicknames: t.nicknames, colours: t.colours, ready: t.status === 'ready', imageId: t.imageId })),
      })),
    });
  } catch (e) {
    console.error('teams GET failed', e);
    return NextResponse.json(off);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const path = typeof body.team === 'string' ? body.team.slice(0, 120) : '';
  if (!UUID.test(id) || !path) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  try {
    if (!(await getSetting('team_switch_enabled'))) return NextResponse.json({ status: 'unavailable', reason: 'off' });
    const supabase = serviceClient();
    const ctx = await teamContext(supabase, id);
    const team = ctx?.teams.find(t => t.path === path);
    if (!ctx || !team) return NextResponse.json({ status: 'unavailable', reason: 'team' });
    if (team.imageId) return NextResponse.json({ status: 'done', imageId: team.imageId });

    let result = await peekTeamVariant(ctx.sourceId, team.id);
    if (!result && !body.peek) {
      const ipHash = hashIp(getClientIp(request.headers));
      const limit = await getSetting('team_switch_hourly_limit');
      const { count } = await supabase.from('design_team_variants').select('id', { count: 'exact', head: true })
        .eq('ip_hash', ipHash).gte('created_at', new Date(Date.now() - 3600_000).toISOString());
      result = (count ?? 0) >= limit
        ? { status: 'unavailable', reason: 'busy' }
        : await ensureTeamVariant({ sourceId: ctx.sourceId, team, requestedBy: 'customer', ipHash });
    }
    result ??= { status: 'pending' };
    return NextResponse.json(result.status === 'failed' ? { status: 'failed' } : result);
  } catch (e) {
    console.error('teams POST failed', e);
    return NextResponse.json({ status: 'failed' }, { status: 500 });
  }
}
