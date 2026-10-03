/**
 * PATCH /api/admin/collections/designs/[id]
 *   { tags: string[] }                — set the shown tags (kept when the design is re-tagged)
 *   { add: collectionId }             — put the design in a collection (by hand)
 *   { remove: collectionId }          — take it out; theme filing and auto-tagging won't put it back
 *   { retag: true }                   — ask the tagger again (hand-set tags are kept)
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { autoTagImage, cleanTags } from '@/lib/collections/auto-tag';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const UUID = /^[0-9a-f-]{36}$/i;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const supabase = serviceClient();
  try {
    const { data: design } = await supabase.from('image_catalog').select('id, is_customer_generated').eq('id', id).maybeSingle();
    if (!design || design.is_customer_generated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (Array.isArray(body.tags)) {
      const tags = cleanTags(body.tags);
      const { error } = await supabase.from('image_catalog').update({ display_tags: tags, display_tags_edited: true }).eq('id', id);
      if (error) throw error;
      return NextResponse.json({ ok: true, tags });
    }
    if (body.add || body.remove) {
      const cid = String(body.add || body.remove);
      if (!UUID.test(cid)) return NextResponse.json({ error: 'Pick a collection' }, { status: 400 });
      const { data: c } = await supabase.from('collections').select('id').eq('id', cid).maybeSingle();
      if (!c) return NextResponse.json({ error: 'That collection no longer exists' }, { status: 400 });
      const { error } = await supabase.from('design_collections')
        .upsert({ image_id: id, collection_id: cid, source: 'admin', excluded: !!body.remove }, { onConflict: 'image_id,collection_id' });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (body.retag) {
      const r = await autoTagImage(supabase, id, { force: true });
      return r.ok ? NextResponse.json({ ok: true, answer: r.answer }) : NextResponse.json({ error: `Tagging failed: ${r.error}` }, { status: 502 });
    }
    return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });
  } catch (e) {
    console.error('admin design tags PATCH failed', e);
    return NextResponse.json({ error: 'Could not save' }, { status: 500 });
  }
}
