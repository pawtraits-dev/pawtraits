/**
 * Website "recent custom creations" feed (server only). Genuine paid orders (plus free previews when
 * "Include free previews" is on) that passed the photo check, aren't opted out or hidden, and only while the feed is switched on (Admin → Social).
 * Returns the pet's first name and town/country — never names, emails or addresses.
 */
import { serviceClient } from '@/lib/qr/server';
import { getSetting } from '@/lib/app-settings';
import { placeLabel } from './privacy';

export interface FeedItem { id: string; kind: 'purchase' | 'preview'; petName: string | null; place: string | null; beforeUrl: string; afterUrl: string; paidAt: string }

const W = 640, H = 800; // 4:5, the same frame Instagram uses

function cloud() {
  return process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
}

/** Customer photo filling a 4:5 frame, centred on the pet */
export function beforeFrame(publicId: string | null, fallback: string): string {
  const c = cloud();
  return c && publicId ? `https://res.cloudinary.com/${c}/image/upload/c_fill,g_auto,w_${W},h_${H}/f_auto,q_auto/${publicId}` : fallback;
}

/** Portrait fitted whole into the 4:5 frame (blurred fill at the edges, nothing cropped), watermarked */
export function afterFrame(publicId: string | null, fallback: string): string {
  const c = cloud();
  if (!c || !publicId) return fallback; // after_url is already the watermarked preview
  const wm = process.env.CLOUDINARY_WATERMARK_PUBLIC_ID || 'pawtraits_watermark_logo';
  const op = parseInt(process.env.CLOUDINARY_WATERMARK_OPACITY || '20', 10);
  return `https://res.cloudinary.com/${c}/image/upload/c_pad,b_blurred:400:15,w_${W},h_${H}/l_${wm},o_${op},g_center,w_0.6,fl_relative/f_auto,q_auto/${publicId}`;
}

const BAD_ORDER_STATUSES = ['cancelled', 'canceled', 'refunded', 'on_hold'];

export async function getFeed(limit = 12): Promise<FeedItem[]> {
  const [enabled, includePreviews] = await Promise.all([getSetting('social_feed_enabled'), getSetting('social_include_previews')]);
  if (!enabled) return [];
  let q = serviceClient().from('social_items')
    .select('id, source, pet_name, town, country, before_public_id, before_url, after_public_id, after_url, paid_at, orders:order_id (payment_status, status), custom:custom_image_id (rating)')
    .eq('check_status', 'approved').eq('opted_out', false).eq('hidden', false)
    .order('paid_at', { ascending: false }).limit(limit * 3);
  if (!includePreviews) q = q.eq('source', 'purchase');
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? [])
    // Purchases: genuinely paid and not refunded/cancelled. Previews: not rated 1–2 stars by the customer.
    .filter((r: any) => r.source === 'preview'
      ? !(r.custom?.rating && r.custom.rating <= 2)
      : r.orders?.payment_status === 'paid' && !BAD_ORDER_STATUSES.includes(r.orders?.status))
    .slice(0, limit)
    .map((r: any) => ({
      id: r.id,
      kind: r.source === 'preview' ? 'preview' : 'purchase',
      petName: r.pet_name,
      place: placeLabel(r.town, r.country),
      beforeUrl: beforeFrame(r.before_public_id, r.before_url),
      afterUrl: afterFrame(r.after_public_id, r.after_url),
      paidAt: r.paid_at,
    }));
}
