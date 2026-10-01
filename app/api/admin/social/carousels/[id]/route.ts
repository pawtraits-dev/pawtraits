/**
 * PATCH /api/admin/social/carousels/[id]
 *   { caption }                               save an edited caption (kept as the pets change)
 *   { action: 'reset_caption' }               back to the automatic caption
 *   { action: 'mark_posted', permalink }      posted by hand in the Instagram app
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { fillBatches, refreshBatch } from '@/lib/social/carousel';

const IG_RE = /^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9_./?=&-]{3,200}$/;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const supabase = serviceClient();
  const { data: batch } = await supabase.from('social_batches').select('id, status').eq('id', id).maybeSingle();
  if (!batch) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!['filling', 'ready', 'failed'].includes(batch.status)) return NextResponse.json({ error: 'This carousel has already been posted' }, { status: 409 });

  try {
    if (typeof body.caption === 'string') {
      const caption = body.caption.trim();
      if (!caption || caption.length > 2200) return NextResponse.json({ error: 'Caption: 1–2,200 characters (Instagram’s limit)' }, { status: 400 });
      if ((caption.match(/#/g) || []).length > 30) return NextResponse.json({ error: 'Instagram allows up to 30 hashtags' }, { status: 400 });
      await supabase.from('social_batches').update({ caption, caption_edited: true, updated_at: new Date().toISOString() }).eq('id', id);
    } else if (body.action === 'reset_caption') {
      await supabase.from('social_batches').update({ caption_edited: false }).eq('id', id);
      await refreshBatch(supabase, id, false);
    } else if (body.action === 'mark_posted') {
      const permalink = String(body.permalink || '').trim();
      if (!IG_RE.test(permalink)) return NextResponse.json({ error: 'Paste the Instagram post link (https://www.instagram.com/p/…)' }, { status: 400 });
      if (batch.status !== 'ready') return NextResponse.json({ error: 'Only a full carousel (5 pets) can be marked as posted' }, { status: 409 });
      await supabase.from('social_batches').update({ status: 'posted', ig_permalink: permalink, posted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id);
      await fillBatches(supabase);
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
    const { data } = await supabase.from('social_batches').select('*').eq('id', id).maybeSingle();
    return NextResponse.json(data);
  } catch (err) {
    console.error('admin carousel update failed', err);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}
