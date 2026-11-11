/**
 * Phone-case art for designs (admin). See lib/phone-cases/case-art.ts
 * GET                     designs that have case art (id, title, thumbnail, status per layout)
 * GET ?design=<id>        one design: title, thumbnail, aspect, and its case art per layout
 * POST  { designId, group }            generate (or redo) that layout's case art (Gemini, ~30–60 s)
 * PATCH { designId, group, status }    'approved' | 'rejected'
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { generateCaseArt, setCaseArtStatus } from '@/lib/phone-cases/case-art';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GROUP = /^[A-Z]$/;
const cloud = () => process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const thumb = (id: string | null, w = 300) => (id ? `https://res.cloudinary.com/${cloud()}/image/upload/w_${w},c_limit,q_auto,f_auto/${id}` : null);
const title = (d: string | null) => (d || '').match(/\*\*(.+?)\*\*/)?.[1]?.trim() || (d || '').replace(/[#*_]/g, '').trim().slice(0, 60) || 'Untitled design';
const missingColumn = (m: string) => /case_art/.test(m) && /does not exist|Could not find/i.test(m);

export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const db = serviceClient();
  const id = req.nextUrl.searchParams.get('design');
  if (id) {
    if (!UUID.test(id)) return NextResponse.json({ error: 'That isn’t a design ID' }, { status: 400 });
    const { data, error } = await db.from('image_catalog').select('id, description, cloudinary_public_id, case_art, formats(aspect_ratio)').eq('id', id).maybeSingle();
    if (error) return NextResponse.json({ error: missingColumn(error.message) ? 'Run db/migrations/2026-11-11-phone-case-art.sql first.' : error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Design not found' }, { status: 404 });
    const art = Object.fromEntries(Object.entries((data.case_art || {}) as Record<string, any>).map(([g, e]) => [g, { ...e, url: thumb(e.public_id, 900) }]));
    return NextResponse.json({ id: data.id, title: title(data.description), thumb: thumb(data.cloudinary_public_id, 400), aspect: (data as any).formats?.aspect_ratio ?? null, case_art: art });
  }
  const { data, error } = await db.from('image_catalog').select('id, description, cloudinary_public_id, case_art').neq('case_art', '{}').order('created_at', { ascending: false }).limit(200);
  if (error) return NextResponse.json({ error: missingColumn(error.message) ? 'Run db/migrations/2026-11-11-phone-case-art.sql first.' : error.message }, { status: 500 });
  return NextResponse.json({
    designs: (data ?? []).map((d: any) => ({
      id: d.id, title: title(d.description), thumb: thumb(d.cloudinary_public_id, 160),
      status: Object.fromEntries(Object.entries(d.case_art || {}).map(([g, e]: [string, any]) => [g, e.status])),
    })),
  });
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { designId, group } = await req.json().catch(() => ({}));
  if (!UUID.test(designId || '') || !GROUP.test(group || '')) return NextResponse.json({ error: 'designId and group are required' }, { status: 400 });
  try {
    const entry = await generateCaseArt(serviceClient(), designId, group);
    return NextResponse.json({ ...entry, url: thumb(entry.public_id, 900) });
  } catch (e: any) {
    console.error('case art failed', designId, group, e);
    return NextResponse.json({ error: e?.message || 'Case art failed' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { designId, group, status } = await req.json().catch(() => ({}));
  if (!UUID.test(designId || '') || !GROUP.test(group || '') || !['approved', 'rejected'].includes(status)) return NextResponse.json({ error: 'designId, group and status are required' }, { status: 400 });
  try {
    const entry = await setCaseArtStatus(serviceClient(), designId, group, status);
    return NextResponse.json({ ...entry, url: thumb(entry.public_id, 900) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not update' }, { status: 400 });
  }
}
