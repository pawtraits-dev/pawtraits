/**
 * PATCH /api/admin/social/items/[id]  { action: 'hide' | 'unhide' | 'approve' | 'recheck' | 'ig_exclude' | 'ig_include' | 'set_hero' | 'clear_hero' }
 * ig_exclude: keep it off Instagram only (website feed unaffected); ig_include undoes it.
 * hide: never show this order (feed or Instagram; leaves an unposted carousel).
 * approve: feature it even though the photo check rejected it. recheck: run the check again.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { checkSocialItem } from '@/lib/social/capture';
import { getSetting, setSetting } from '@/lib/app-settings';
import { revalidatePath } from 'next/cache';
import { fillBatches } from '@/lib/social/carousel';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { action } = await request.json().catch(() => ({}));
  const supabase = serviceClient();

  const { data: item } = await supabase.from('social_items').select('id, batch_id, social_batches:batch_id (status)').eq('id', id).maybeSingle();
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const batchStatus = (item as any).social_batches?.status as string | undefined;
  const posted = batchStatus === 'posted' || batchStatus === 'publishing';

  try {
    if (action === 'hide') {
      await supabase.from('social_items').update({ hidden: true, ...(posted ? {} : { batch_id: null }) }).eq('id', id);
      if (posted) await supabase.from('social_batches').update({ needs_removal: true, updated_at: new Date().toISOString() }).eq('id', item.batch_id);
    } else if (action === 'unhide') {
      await supabase.from('social_items').update({ hidden: false }).eq('id', id);
    } else if (action === 'approve') {
      await supabase.from('social_items').update({ check_status: 'approved', check_reasons: [], checked_at: new Date().toISOString() }).eq('id', id);
    } else if (action === 'recheck') {
      await supabase.from('social_items').update({ check_attempts: 0 }).eq('id', id);
      await checkSocialItem(supabase, id);
    } else if (action === 'ig_exclude') {
      if (posted) return NextResponse.json({ error: 'Already posted. Use Hide to have it taken down.' }, { status: 409 });
      await supabase.from('social_items').update({ ig_excluded: true, batch_id: null }).eq('id', id);
    } else if (action === 'set_hero') {
      const { data: row } = await supabase.from('social_items').select('opted_out').eq('id', id).single();
      if (row?.opted_out) return NextResponse.json({ error: 'This customer opted out of being featured' }, { status: 409 });
      // Top of the home page; featuring it too, since the hero only shows featured items
      await supabase.from('social_items').update({ check_status: 'approved', check_reasons: [], hidden: false, checked_at: new Date().toISOString() }).eq('id', id);
      await setSetting('social_hero_item_id', id);
    } else if (action === 'clear_hero') {
      if ((await getSetting('social_hero_item_id')) === id) await setSetting('social_hero_item_id', '');
    } else if (action === 'ig_include') {
      await supabase.from('social_items').update({ ig_excluded: false }).eq('id', id);
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
    await fillBatches(supabase);
    if (['set_hero', 'clear_hero', 'hide', 'unhide', 'approve'].includes(action)) revalidatePath('/');
    const { data: updated } = await supabase.from('social_items').select('id, check_status, check_reasons, hidden, opted_out, batch_id').eq('id', id).single();
    return NextResponse.json(updated);
  } catch (err) {
    console.error('admin social item update failed', err);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}
