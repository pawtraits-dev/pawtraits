/**
 * PATCH /api/admin/collections/[id] — edit name, short name, description, seasons, search words,
 * order, hero picture, on/off. Paths and slugs stay fixed so customer links never break.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { cleanTerms, cleanWindows } from '@/lib/collections/server';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f-]{36}$/i;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  const text = (k: string, max: number, required = false) => {
    if (!(k in body)) return null;
    const v = String(body[k] ?? '').trim().slice(0, max);
    if (required && !v) return `${k.replace('_', ' ')} can’t be empty`;
    patch[k] = v || null;
    return null;
  };
  const err = text('name', 80, true) || text('short_name', 30) || text('description', 300);
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  if ('season_windows' in body) {
    const w = cleanWindows(body.season_windows);
    if ('error' in w) return NextResponse.json({ error: w.error }, { status: 400 });
    patch.season_windows = w.windows;
  }
  if ('search_terms' in body) patch.search_terms = cleanTerms(body.search_terms);
  if ('sort_order' in body) patch.sort_order = Math.round(Number(body.sort_order) || 0);
  if ('is_active' in body) patch.is_active = !!body.is_active;
  if ('hero_image_id' in body) {
    if (body.hero_image_id && !UUID.test(body.hero_image_id)) return NextResponse.json({ error: 'Pick a design for the picture' }, { status: 400 });
    patch.hero_image_id = body.hero_image_id || null;
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });
  try {
    const { data, error } = await serviceClient().from('collections').update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('admin collection PATCH failed', e);
    return NextResponse.json({ error: 'Could not save' }, { status: 500 });
  }
}
