/**
 * POST /api/admin/collections/team-versions/[id]/lettering  { name, number?, team? }
 * Admin lettering test for a personalised-kit design: paints the name and number onto the
 * design (or onto a team's ready version, when `team` is given), reads the shirt back with
 * Claude Haiku and saves the result in kit_lettering_tests. About 60–90 s; ~13p per test.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { teamContext } from '@/lib/collections/team-variants';
import { letteringMatches, paintLettering, readShirt } from '@/lib/collections/kit-lettering';
import { cleanKitName, cleanKitNumber } from '@/lib/collections/sports-teams';
import { uploadImageBufferToCloudinary } from '@/lib/cloudinary-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 180;
const UUID = /^[0-9a-f-]{36}$/i;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const name = cleanKitName(body.name);
  const number = cleanKitNumber(body.number);
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!name) return NextResponse.json({ error: 'Name: capital letters, spaces, hyphens or apostrophes, up to 12' }, { status: 400 });
  if (number === undefined) return NextResponse.json({ error: 'Number: 0 to 99, or leave it empty' }, { status: 400 });

  const supabase = serviceClient();
  const started = Date.now();
  try {
    const ctx = await teamContext(supabase, id);
    if (!ctx) return NextResponse.json({ error: 'Not a sports design' }, { status: 404 });
    let designId = ctx.sourceId;
    if (body.team) {
      const team = ctx.teams.find(t => t.path === body.team);
      if (!team?.imageId) return NextResponse.json({ error: 'Make that team’s version first' }, { status: 400 });
      designId = team.imageId;
    }

    const { data: design } = await supabase.from('image_catalog').select('id, cloudinary_public_id, public_url').eq('id', designId).maybeSingle();
    if (!design) return NextResponse.json({ error: 'Design not found' }, { status: 404 });
    const cloud = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const url = design.cloudinary_public_id && cloud
      ? `https://res.cloudinary.com/${cloud}/image/upload/c_limit,w_1536,h_1536/f_png/${design.cloudinary_public_id}`
      : design.public_url;
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`Could not fetch the design (${res.status})`);
    const base64 = Buffer.from(await res.arrayBuffer()).toString('base64');

    const painted = await paintLettering(base64, name, number, { imageId: designId });
    const [uploaded, reading] = await Promise.all([
      uploadImageBufferToCloudinary(Buffer.from(painted, 'base64'), `kit-test-${name.toLowerCase().replace(/[^a-z]/g, '')}-${Date.now()}.png`, { folder: 'pawtraits/kit-tests', tags: ['kit-test'] }),
      readShirt(painted, 'image/png', { imageId: designId }),
    ]);
    const row = {
      design_id: designId, source_id: ctx.sourceId, kit_name: name, kit_number: number,
      image_url: uploaded.secure_url, cloudinary_public_id: uploaded.public_id,
      read_name: reading.name, read_number: reading.number, logos: reading.logos,
      matches: letteringMatches(reading, name, number) && !reading.logos,
      duration_ms: Date.now() - started,
    };
    const { data: saved, error } = await supabase.from('kit_lettering_tests').insert(row).select('*').single();
    if (error) console.error('kit test save failed', error);
    return NextResponse.json({ test: saved ?? row });
  } catch (e: any) {
    console.error('kit lettering test failed', e);
    await supabase.from('kit_lettering_tests').insert({ design_id: id, source_id: id, kit_name: name, kit_number: number, error: String(e?.message || e).slice(0, 500), duration_ms: Date.now() - started });
    return NextResponse.json({ error: e?.message || 'The lettering test failed' }, { status: 500 });
  }
}
