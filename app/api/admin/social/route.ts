/**
 * GET /api/admin/social?view=all|featured|rejected|checking|opted_out|hidden&limit=50
 * Admin → Social: channel switches, counts, the latest social items (with before/after
 * thumbnails), stall towns, and carousels that need taking down.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { getSetting } from '@/lib/app-settings';
import { cldUrl } from '@/lib/social/capture';
import { placeLabel } from '@/lib/social/privacy';

export const dynamic = 'force-dynamic';
const VIEWS = ['all', 'featured', 'rejected', 'checking', 'opted_out', 'hidden'] as const;
type View = typeof VIEWS[number];

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const view = (VIEWS as readonly string[]).includes(request.nextUrl.searchParams.get('view') || '') ? request.nextUrl.searchParams.get('view') as View : 'all';
  const limit = Math.min(200, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 50));
  const supabase = serviceClient();

  try {
    let q = supabase.from('social_items')
      .select('id, order_id, source, ig_excluded, pet_name, town, country, location_source, channel, stall_name, before_public_id, before_url, after_public_id, after_url, check_status, check_reasons, checked_at, opted_out, hidden, batch_id, paid_at, orders:order_id (order_number)')
      .order('paid_at', { ascending: false }).limit(limit);
    if (view === 'featured') q = q.eq('check_status', 'approved').eq('opted_out', false).eq('hidden', false);
    if (view === 'rejected') q = q.eq('check_status', 'rejected');
    if (view === 'checking') q = q.in('check_status', ['pending', 'error']);
    if (view === 'opted_out') q = q.eq('opted_out', true);
    if (view === 'hidden') q = q.eq('hidden', true);
    const { data: items, error } = await q;
    if (error) throw error;

    const count = async (f: (q: any) => any) => {
      const { count } = await f(supabase.from('social_items').select('id', { count: 'exact', head: true }));
      return count ?? 0;
    };
    const [featured, rejected, checking, optedOut, hidden, total] = await Promise.all([
      count(q => q.eq('check_status', 'approved').eq('opted_out', false).eq('hidden', false)),
      count(q => q.eq('check_status', 'rejected')),
      count(q => q.in('check_status', ['pending', 'error'])),
      count(q => q.eq('opted_out', true)),
      count(q => q.eq('hidden', true)),
      count(q => q),
    ]);

    const [{ data: stalls }, { data: removals }, feedEnabled, instagramEnabled, photoCheckEnabled, includePreviews, heroItemId] = await Promise.all([
      supabase.from('stock_locations').select('id, name, town, country, location_type').eq('location_type', 'stall').eq('is_active', true).order('name'),
      supabase.from('social_batches').select('id, ig_permalink, posted_at').eq('needs_removal', true),
      getSetting('social_feed_enabled'), getSetting('social_instagram_enabled'), getSetting('social_photo_check_enabled'),
      getSetting('social_include_previews'), getSetting('social_hero_item_id'),
    ]);

    return NextResponse.json({
      settings: { social_feed_enabled: feedEnabled, social_instagram_enabled: instagramEnabled, social_photo_check_enabled: photoCheckEnabled, social_include_previews: includePreviews },
      heroItemId: heroItemId || null,
      counts: { total, featured, rejected, checking, optedOut, hidden },
      items: (items ?? []).map((i: any) => ({
        id: i.id, orderId: i.order_id, orderNumber: i.orders?.order_number ?? null,
        petName: i.pet_name, place: placeLabel(i.town, i.country), locationSource: i.location_source,
        channel: i.channel, stallName: i.stall_name,
        beforeThumb: (i.before_public_id && cldUrl(i.before_public_id, 'c_fill,g_auto,w_160,h_200/f_jpg,q_70')) || i.before_url,
        afterThumb: (i.after_public_id && cldUrl(i.after_public_id, 'c_fill,g_auto,w_160,h_200/f_jpg,q_70')) || i.after_url,
        checkStatus: i.check_status, checkReasons: i.check_reasons ?? [], checkedAt: i.checked_at,
        optedOut: i.opted_out, hidden: i.hidden, batchId: i.batch_id, paidAt: i.paid_at,
        source: i.source ?? 'purchase', igExcluded: !!i.ig_excluded,
      })),
      stalls: stalls ?? [],
      removals: removals ?? [],
    });
  } catch (err: any) {
    console.error('admin social failed', err);
    return NextResponse.json({ error: err?.message?.includes('social_items') ? 'Run the social loop migration (2026-10-04-social-loop.sql) first.' : 'Could not load social items' }, { status: 500 });
  }
}
