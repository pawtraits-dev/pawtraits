/**
 * PATCH /api/admin/collections/themes/[id] { collection_id | null } — point a theme at a
 * collection and file its designs there straight away (designs added later file themselves).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f-]{36}$/i;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const collectionId = body.collection_id || null;
  if (!UUID.test(id) || (collectionId && !UUID.test(collectionId))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const supabase = serviceClient();
  try {
    if (collectionId) {
      const { data: c } = await supabase.from('collections').select('id').eq('id', collectionId).maybeSingle();
      if (!c) return NextResponse.json({ error: 'That collection no longer exists' }, { status: 400 });
    }
    const { data: t, error } = await supabase.from('themes').update({ default_collection_id: collectionId }).eq('id', id).select('id').maybeSingle();
    if (error) throw error;
    if (!t) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { data: added, error: applyErr } = await supabase.rpc('apply_theme_collection', { p_theme_id: id });
    if (applyErr) throw applyErr;
    return NextResponse.json({ ok: true, added: added ?? 0 });
  } catch (e) {
    console.error('theme collection PATCH failed', e);
    return NextResponse.json({ error: 'Could not save' }, { status: 500 });
  }
}
