/**
 * GET /api/admin/social/carousels
 * Instagram carousel preview: unposted carousels (filling, ready, failed) and the last 10 posted,
 * each with its slides (photo → Pawtrait per pet, 1080×1350), caption and status, plus how many
 * featured pets are waiting. Tops up carousels first, so it reflects the current settings.
 */
import { NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { getSetting } from '@/lib/app-settings';
import { BATCH_SIZE, afterSlide, beforeSlide, downloadUrl, fillBatches } from '@/lib/social/carousel';
import { placeLabel } from '@/lib/social/privacy';

export const dynamic = 'force-dynamic';

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const supabase = serviceClient();
  try {
    await fillBatches(supabase);
    const [{ data: open }, { data: done }, includePreviews, instagramEnabled] = await Promise.all([
      supabase.from('social_batches').select('*').in('status', ['filling', 'ready', 'publishing', 'failed']).order('created_at', { ascending: true }),
      supabase.from('social_batches').select('*').eq('status', 'posted').order('posted_at', { ascending: false }).limit(10),
      getSetting('social_include_previews'), getSetting('social_instagram_enabled'),
    ]);
    const batches = [...(open ?? []), ...(done ?? [])];
    const { data: items } = batches.length
      ? await supabase.from('social_items')
          .select('id, batch_id, pet_name, town, country, channel, stall_name, source, before_public_id, before_url, after_public_id, after_url, paid_at')
          .in('batch_id', batches.map(b => b.id)).order('paid_at', { ascending: true })
      : { data: [] as any[] };

    return NextResponse.json({
      batchSize: BATCH_SIZE,
      includePreviews, instagramEnabled,
      carousels: batches.map(b => {
        const mine = (items ?? []).filter((i: any) => i.batch_id === b.id);
        return {
          id: b.id, status: b.status, caption: b.caption ?? '', captionEdited: b.caption_edited,
          igPermalink: b.ig_permalink, postedAt: b.posted_at, error: b.error, needsRemoval: b.needs_removal, createdAt: b.created_at,
          items: mine.map((i: any, n: number) => {
            const before = beforeSlide(i.before_public_id, i.before_url);
            const after = afterSlide(i.after_public_id, i.after_url);
            const slug = (i.pet_name || 'pet').toLowerCase().replace(/[^a-z0-9]+/g, '-');
            return {
              id: i.id, petName: i.pet_name, place: i.channel === 'stall' && i.stall_name ? i.stall_name : placeLabel(i.town, i.country),
              source: i.source, paidAt: i.paid_at,
              beforeSlide: before, afterSlide: after,
              beforeDownload: downloadUrl(before, `${String(n * 2 + 1).padStart(2, '0')}-${slug}-photo`),
              afterDownload: downloadUrl(after, `${String(n * 2 + 2).padStart(2, '0')}-${slug}-pawtrait`),
              postable: !!(i.before_public_id && i.after_public_id),
            };
          }),
        };
      }),
    });
  } catch (err) {
    console.error('admin carousels failed', err);
    return NextResponse.json({ error: 'Could not load carousels' }, { status: 500 });
  }
}
