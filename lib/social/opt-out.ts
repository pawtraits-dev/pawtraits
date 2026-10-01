/**
 * "Don't feature my pet" (server only). The link in emails carries the order id and a signature,
 * never the email address. Opting out covers every order from that email address, past and
 * future: items leave the website feed and any carousel not yet posted; a carousel already on
 * Instagram is flagged in Admin → Social for removal in the Instagram app.
 */
import { createHmac, timingSafeEqual } from 'crypto';
import { serviceClient } from '@/lib/qr/server';
import { fillBatches } from './carousel';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function secret() {
  return process.env.SOCIAL_LINK_SECRET || process.env.DOWNLOAD_LINK_SECRET || process.env.QR_ATTRIBUTION_SECRET
    || `social-${process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-16) ?? 'dev'}`;
}

export function signOptOut(orderId: string): string {
  return createHmac('sha256', secret()).update(`social-optout:${orderId}`).digest('base64url').slice(0, 32);
}

export function verifyOptOut(orderId: unknown, token: unknown): orderId is string {
  if (typeof orderId !== 'string' || typeof token !== 'string' || !UUID_RE.test(orderId)) return false;
  const a = Buffer.from(signOptOut(orderId)), b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function optOutUrl(baseUrl: string, orderId: string): string {
  return `${baseUrl.replace(/\/$/, '')}/social/opt-out?o=${orderId}&t=${signOptOut(orderId)}`;
}

/** Records the opt-out for the order's email. Returns false if the order isn't found. */
export async function optOutByOrder(orderId: string): Promise<boolean> {
  const supabase = serviceClient();
  const { data: order } = await supabase.from('orders').select('id, customer_email').eq('id', orderId).maybeSingle();
  const email = order?.customer_email?.trim().toLowerCase();
  if (!email) return false;

  await supabase.from('social_opt_outs').upsert({ email }, { onConflict: 'email', ignoreDuplicates: true });
  const { data: items } = await supabase.from('social_items').update({ opted_out: true })
    .eq('customer_email', email).select('id, batch_id');

  const batchIds = Array.from(new Set((items ?? []).map(i => i.batch_id).filter(Boolean))) as string[];
  if (batchIds.length) {
    const { data: batches } = await supabase.from('social_batches').select('id, status').in('id', batchIds);
    const posted = (batches ?? []).filter(b => b.status === 'posted' || b.status === 'publishing').map(b => b.id);
    const unposted = (batches ?? []).filter(b => !posted.includes(b.id)).map(b => b.id);
    // Not yet on Instagram: take them out of the carousel (it refills from the next orders)
    if (unposted.length) {
      await supabase.from('social_items').update({ batch_id: null }).eq('customer_email', email).in('batch_id', unposted);
      await supabase.from('social_batches').update({ status: 'filling', updated_at: new Date().toISOString() }).in('id', unposted).eq('status', 'ready');
    }
    if (posted.length) {
      await supabase.from('social_batches').update({ needs_removal: true, updated_at: new Date().toISOString() }).in('id', posted);
    }
    await fillBatches(supabase);
  }
  return true;
}
