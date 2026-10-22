/**
 * Admin → Collections → Team versions, one design.
 * GET   — the teams it offers, each with its version (thumbnail) and status
 * PATCH { team_switch: 'league' | 'any' | 'off' } — which teams it offers
 *       { kit_personalisation: { name, number, scene } | null } — personalised kit settings
 * POST  { team: "<collection path>", redo?: true } — make that team's version now (retries
 *       failed ones; redo paints a ready one again)
 *       { team, action: 'publish' | 'unpublish' } — show it on its team's collection page or not
 *       { team, action: 'describe' } — write a fresh title and description from the picture
 *       { team, action: 'save-description', description } — save an edited description
 *       { action: 'use-test', testId } — make a lettering test (painted on the original) the
 *       design's picture, e.g. a generic "GOOD DOG 1" for stall stock instead of the sample pet's
 *       name. The kit settings take the test's name and number; the old picture is kept in
 *       kit_personalisation.previous. Then repaint the team versions so they match.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { describeTeamVersion, ensureTeamVariant, groupByLeague, setTeamVersionPublished, teamContext } from '@/lib/collections/team-variants';
import { readKit } from '@/lib/collections/kit-lettering';
import { cleanKitName, cleanKitNumber } from '@/lib/collections/sports-teams';

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
    const { data: imgs } = imageIds.length ? await supabase.from('image_catalog').select('id, cloudinary_public_id, public_url, description').in('id', imageIds) : { data: [] };
    const descOf = new Map((imgs ?? []).map((r: any) => [r.id, r.description as string | null]));
    const { data: pub } = imageIds.length ? await supabase.from('design_collections').select('image_id').eq('source', 'team').in('image_id', imageIds) : { data: [] };
    const published = new Set((pub ?? []).map((r: any) => r.image_id));
    const cloud = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const thumbOf = new Map((imgs ?? []).map((r: any) => [r.id, cloud && r.cloudinary_public_id ? `https://res.cloudinary.com/${cloud}/image/upload/c_fill,w_160,h_200,g_auto/f_auto,q_auto/${r.cloudinary_public_id}` : r.public_url]));
    const { data: rows } = await supabase.from('design_team_variants').select('*').eq('source_image_id', ctx.sourceId);
    const errorOf = new Map((rows ?? []).filter((e: any) => e.status === 'failed').map((e: any) => [e.team_collection_id, e.error]));
    const checkOf = new Map((rows ?? []).filter((e: any) => e.status === 'done' && e.kit_check).map((e: any) => [e.team_collection_id, e.kit_check]));
    // Personalised kit settings and lettering tests (empty before the 2026-10-20 migration)
    const { data: src } = await supabase.from('image_catalog').select('kit_personalisation').eq('id', ctx.sourceId).maybeSingle();
    const { data: tests } = await supabase.from('kit_lettering_tests').select('*').eq('source_id', ctx.sourceId).order('created_at', { ascending: false }).limit(40);
    return NextResponse.json({
      scope: ctx.scope, home: ctx.homeTeamPath, sourceId: ctx.sourceId,
      kit: readKit((src as any)?.kit_personalisation),
      tests: (tests ?? []).map((t: any) => ({ ...t, thumb: cloud && t.cloudinary_public_id ? `https://res.cloudinary.com/${cloud}/image/upload/c_fill,w_240,h_300,g_auto/f_auto,q_auto/${t.cloudinary_public_id}` : t.image_url })),
      groups: groupByLeague(ctx.teams).map(g => ({
        league: g.league, name: g.name,
        teams: g.teams.map(t => ({ path: t.path, name: t.name, short: t.short, colours: t.colours, status: t.status, imageId: t.imageId, thumb: t.imageId ? thumbOf.get(t.imageId) ?? null : null, error: errorOf.get(t.id) ?? null, check: checkOf.get(t.id) ?? null, description: t.imageId && t.path !== ctx.homeTeamPath ? descOf.get(t.imageId) ?? null : null, published: !!t.imageId && (t.path === ctx.homeTeamPath || published.has(t.imageId)) })),
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
  if (UUID.test(id) && 'kit_personalisation' in body) {
    const k = body.kit_personalisation;
    let value: any = null;
    if (k) {
      const name = cleanKitName(k.name);
      const number = cleanKitNumber(k.number);
      if (!name) return NextResponse.json({ error: 'Name: capital letters, spaces, hyphens or apostrophes, up to 12' }, { status: 400 });
      if (number === undefined) return NextResponse.json({ error: 'Number: 0 to 99, or leave it empty' }, { status: 400 });
      value = { name, number, scene: k.scene !== false, slogan: k.slogan === true };
    }
    const { error } = await serviceClient().from('image_catalog').update({ kit_personalisation: value }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message.includes('kit_personalisation') ? 'Run the 2026-10-20-personalised-kits migration first' : 'Could not save' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
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
  if (UUID.test(id) && body.action === 'use-test') return useLetteringTest(id, String(body.testId || ''));
  if (!UUID.test(id) || typeof body.team !== 'string') return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  try {
    const supabase = serviceClient();
    let ctx = await teamContext(supabase, id);
    let team = ctx?.teams.find(t => t.path === body.team);
    if (!ctx || !team) return NextResponse.json({ error: 'That team isn’t offered for this design' }, { status: 400 });
    // Publish, unpublish and descriptions of a ready version (not the original)
    if (typeof body.action === 'string') {
      if (!team.imageId || team.path === ctx.homeTeamPath) return NextResponse.json({ error: 'Make that team’s version first' }, { status: 400 });
      if (body.action === 'publish' || body.action === 'unpublish') {
        await setTeamVersionPublished(team.imageId, team.id, body.action === 'publish');
        return NextResponse.json({ ok: true });
      }
      if (body.action === 'describe') {
        const description = await describeTeamVersion(team.imageId, team);
        return description ? NextResponse.json({ ok: true, description }) : NextResponse.json({ error: 'Could not write a description' }, { status: 500 });
      }
      if (body.action === 'save-description') {
        const description = String(body.description ?? '').trim().slice(0, 4000);
        if (!description) return NextResponse.json({ error: 'The description is empty' }, { status: 400 });
        await supabase.from('image_catalog').update({ description }).eq('id', team.imageId);
        return NextResponse.json({ ok: true, description });
      }
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
    // Redo a ready version (not the original): mark it failed so it's painted again
    if (body.redo === true && team.path !== ctx.homeTeamPath) {
      await supabase.from('design_team_variants').update({ status: 'failed', attempts: 0, error: 'Redone by admin', updated_at: new Date().toISOString() })
        .eq('source_image_id', ctx.sourceId).eq('team_collection_id', team.id);
      ctx = await teamContext(supabase, id);
      team = ctx?.teams.find(t => t.path === body.team);
      if (!ctx || !team) return NextResponse.json({ error: 'That team isn’t offered for this design' }, { status: 400 });
    }
    const r = await ensureTeamVariant({ sourceId: ctx.sourceId, team, requestedBy: 'admin' });
    return NextResponse.json(r);
  } catch (e) {
    console.error('team version POST failed', e);
    return NextResponse.json({ status: 'failed', error: 'Something went wrong' }, { status: 500 });
  }
}

/** Swap the design's picture for a lettering test painted on it (the new stall / reference lettering) */
async function useLetteringTest(id: string, testId: string) {
  if (!UUID.test(testId)) return NextResponse.json({ error: 'Choose a test' }, { status: 400 });
  const supabase = serviceClient();
  try {
    const ctx = await teamContext(supabase, id);
    if (!ctx) return NextResponse.json({ error: 'Not a sports design' }, { status: 404 });
    const { data: test } = await supabase.from('kit_lettering_tests').select('*').eq('id', testId).maybeSingle();
    if (!test || test.design_id !== ctx.sourceId) return NextResponse.json({ error: 'Use a test painted on the original design' }, { status: 400 });
    if (!test.cloudinary_public_id || test.error) return NextResponse.json({ error: 'That test has no picture' }, { status: 400 });
    if (!test.matches) return NextResponse.json({ error: 'That test didn’t read back correctly: paint it again' }, { status: 400 });

    const { data: src } = await supabase.from('image_catalog').select('cloudinary_public_id, public_url, storage_path, kit_personalisation').eq('id', ctx.sourceId).maybeSingle();
    if (!src) return NextResponse.json({ error: 'Design not found' }, { status: 404 });
    const kit = readKit((src as any).kit_personalisation);
    if (!kit) return NextResponse.json({ error: 'Set up the personalised kit first' }, { status: 400 });
    const old = (src as any).kit_personalisation ?? {};
    const previous = [
      { cloudinary_public_id: src.cloudinary_public_id, public_url: src.public_url, storage_path: src.storage_path, name: kit.name, number: kit.number, replaced_at: new Date().toISOString() },
      ...(Array.isArray(old.previous) ? old.previous : []),
    ].slice(0, 5);
    const { error } = await supabase.from('image_catalog').update({
      cloudinary_public_id: test.cloudinary_public_id, public_url: test.image_url, storage_path: `cloudinary:${test.cloudinary_public_id}`,
      cloudinary_version: null, cloudinary_signature: null,
      kit_personalisation: { ...old, name: test.kit_name, number: test.kit_number, previous },
    }).eq('id', ctx.sourceId);
    if (error) throw error;
    return NextResponse.json({ ok: true, name: test.kit_name, number: test.kit_number });
  } catch (e: any) {
    console.error('use lettering test failed', e);
    return NextResponse.json({ error: 'Could not update the design' }, { status: 500 });
  }
}
