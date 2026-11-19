/**
 * Rear labels for customer prints (pure: no database, no network). One small label per unit we post,
 * stuck on the back of the print: which Pawtrait it is, the pet's name when known, and the customer's
 * own referral QR ("Give 10%, get 10%"). Drawn by generatePrintLabels (lib/stock/print-labels.ts) on the
 * same A4 21-up sheet as the stall-stock labels.
 */
import { postedItems, describeOrderItem, itemTitle, itemRef } from './shared';
import { referralCopy, SITE_URL } from '@/lib/referrals/text';
import type { ReferralRates } from '@/lib/referrals/rates';
import type { PrintLabel } from '@/lib/stock/print-labels';

export interface RearLabelReferral { code: string; shareUrl: string }

export interface RearLabelExtras {
  /** order_items.id → the customer's pet name (null/absent when unknown) */
  petNames?: Map<string, string | null> | null;
  /** order_items.id → resolved Cloudinary public id (null/absent when none) */
  publicIds?: Map<string, string | null> | null;
}

const SIZE_CODES = ['S', 'M', 'L', 'XL'];
export const MAX_PET_NAME_CHARS = 24;
export const FALLBACK_CTA = 'Scan to put your own pet in a Pawtrait';

function asObject(v: any): any {
  if (typeof v !== 'string') return v ?? {};
  try { return JSON.parse(v) ?? {}; } catch { return {}; }
}

/** "FOAM-PRINT-M" → "M"; anything else → "" */
export function sizeCodeOf(productId: unknown): string {
  const last = String(productId ?? '').split('-').pop()?.trim().toUpperCase() ?? '';
  return SIZE_CODES.includes(last) ? last : '';
}

/** "20×30 cm" from the product data, else the packing slip's description */
export function sizeTextOf(item: any): string {
  const p = asObject(item?.product_data);
  const w = Number(p.width_cm), h = Number(p.height_cm);
  return w > 0 && h > 0 ? `${w}×${h} cm` : describeOrderItem(item);
}

/** "MADE FOR BISCUIT" when a name is known (cut to 24 characters), else "PAWTRAITS" */
export function kickerFor(petName: string | null | undefined): string {
  const name = String(petName ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_PET_NAME_CHARS).trim();
  return name ? `MADE FOR ${name.toUpperCase()}` : 'PAWTRAITS';
}

export function buildRearLabels(
  orders: any[],
  referrals: Map<string, RearLabelReferral> | null | undefined,
  rates: ReferralRates,
  extras: RearLabelExtras = {},
): { labels: PrintLabel[]; thumbKeys: Map<string, string> } {
  const labels: PrintLabel[] = [];
  const thumbKeys = new Map<string, string>();
  for (const order of orders) {
    const referral = referrals?.get(order.id) ?? null;
    // Same list and index as the packing slip, so the ref matches the slip and the print file
    postedItems(order).forEach((item: any, index: number) => {
      const publicId = extras.publicIds?.get(item.id) ?? null;
      if (publicId) thumbKeys.set(publicId, publicId);
      const label: PrintLabel = {
        title: itemTitle(item),
        kicker: kickerFor(extras.petNames?.get(item.id)),
        sizeCode: sizeCodeOf(item.product_id),
        sizeText: sizeTextOf(item),
        ref: itemRef(order, index),
        qrUrl: referral ? referral.shareUrl : SITE_URL,
        cta: referral ? `${referralCopy(rates).heading}. Scan to share, or give a friend code ${referral.code}` : FALLBACK_CTA,
        thumbnailKey: publicId,
      };
      const n = Math.max(1, Math.floor(Number(item.quantity) || 1));
      for (let i = 0; i < n; i++) labels.push({ ...label });
    });
  }
  return { labels, thumbKeys };
}
