/**
 * Digital download entitlements.
 *   - Digital download bought      → 'purchase', available immediately
 *   - Print bought (online/stall)  → 'welcome_gift' (if enabled): available now for existing
 *                                    account holders; LOCKED for guest orders until they
 *                                    activate their new account via the emailed link
 * One entitlement per design per order (unique index).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';
import { getSetting } from '@/lib/app-settings';

const productTypeOf = (item: any): string | undefined => {
  const pd = typeof item.product_data === 'string' ? (() => { try { return JSON.parse(item.product_data); } catch { return {}; } })() : item.product_data;
  return pd?.product_type;
};

export async function grantEntitlementsForOrder(
  supabase: SupabaseClient,
  order: { id: string; customer_email: string; is_guest_checkout?: boolean | null },
  items: any[],
  customerId: string | null
): Promise<{ purchased: number; gifts: number }> {
  const giftEnabled = await getSetting('welcome_gift_enabled');
  const now = new Date().toISOString();
  const rows: any[] = [];
  const seen = new Set<string>();

  // Purchased digital downloads first (so a design bought digitally isn't also "gifted")
  for (const item of items) {
    if (productTypeOf(item) !== 'digital_download') continue;
    const key = `p:${item.image_id}`;
    if (seen.has(key)) continue;
    seen.add(key); seen.add(`g:${item.image_id}`);
    rows.push(await row(supabase, order, customerId, item.image_id, 'purchase', 'available', now));
  }
  if (giftEnabled) {
    for (const item of items) {
      const t = productTypeOf(item);
      if (t === 'digital_download') continue;
      const key = `g:${item.image_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const locked = !!order.is_guest_checkout;
      rows.push(await row(supabase, order, customerId, item.image_id, 'welcome_gift', locked ? 'locked' : 'available', locked ? null : now));
    }
  }
  const valid = rows.filter(Boolean);
  if (!valid.length) return { purchased: 0, gifts: 0 };

  const { error } = await supabase
    .from('digital_entitlements')
    .upsert(valid, { onConflict: 'order_id,custom_image_id,catalog_image_id,source', ignoreDuplicates: true });
  if (error) console.error(`❌ Failed to grant entitlements for order ${order.id}`, error);
  return {
    purchased: valid.filter(r => r.source === 'purchase').length,
    gifts: valid.filter(r => r.source === 'welcome_gift').length,
  };
}

async function row(supabase: SupabaseClient, order: any, customerId: string | null, imageId: string, source: string, status: string, unlockedAt: string | null) {
  // Is this a custom portrait or a catalogue design?
  const { data: custom } = await supabase.from('customer_custom_images').select('id').eq('id', imageId).maybeSingle();
  if (!custom) {
    const { data: cat } = await supabase.from('image_catalog').select('id').eq('id', imageId).maybeSingle();
    if (!cat) return null;
  }
  return {
    customer_id: customerId,
    email: order.customer_email.toLowerCase(),
    custom_image_id: custom ? imageId : null,
    catalog_image_id: custom ? null : imageId,
    source, status, unlocked_at: unlockedAt, order_id: order.id,
  };
}

/** Called when a guest activates their account: attach + unlock everything bought with this email. */
export async function claimEntitlements(supabase: SupabaseClient, customerId: string, email: string): Promise<number> {
  const { data, error } = await supabase
    .from('digital_entitlements')
    .update({ customer_id: customerId, status: 'available', unlocked_at: new Date().toISOString() })
    .eq('email', email.toLowerCase())
    .eq('status', 'locked')
    .select('id');
  if (error) console.error('claimEntitlements failed', error);
  // also attach any already-available ones that were created before the customer existed
  await supabase.from('digital_entitlements').update({ customer_id: customerId }).eq('email', email.toLowerCase()).is('customer_id', null);
  return data?.length ?? 0;
}

// ---- Signed download links for purchased downloads (work before the guest activates) ----
function secret() {
  return process.env.DOWNLOAD_LINK_SECRET || process.env.QR_ATTRIBUTION_SECRET || `dl-${process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-16) ?? 'dev'}`;
}
export function signDownload(entitlementId: string, days = 30): string {
  const exp = Math.floor(Date.now() / 1000) + days * 86400;
  const sig = createHmac('sha256', secret()).update(`${entitlementId}.${exp}`).digest('base64url');
  return `${exp}.${sig}`;
}
export function verifyDownload(entitlementId: string, token?: string | null): boolean {
  if (!token) return false;
  const [expStr, sig] = token.split('.');
  const exp = parseInt(expStr, 10);
  if (!exp || !sig || exp < Date.now() / 1000) return false;
  const expected = createHmac('sha256', secret()).update(`${entitlementId}.${exp}`).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
