import type { NextRequest } from 'next/server';
import { QR_ATTRIBUTION_COOKIE, decodeAttribution } from '@/lib/qr/attribution';
import { STALL_SCAN_COOKIE, STALL_SCAN_FRESH_HOURS, resolveScannedEntry } from '@/lib/stall/scanned';
import { getSetting } from '@/lib/app-settings';
import { serviceClient } from '@/lib/qr/server';

export type StallSize = 'S' | 'M' | 'L' | 'XL';
export const STALL_SIZES: StallSize[] = ['S', 'M', 'L', 'XL'];

export { STALL_SCAN_FRESH_HOURS };

export interface StallOffer {
  available: boolean;
  reason?: string;
  locationId?: string;
  locationCode?: string;
  locationName?: string;
  scanId?: string;
  size?: StallSize;
  listPricePence?: number;
  pricePence?: number;
  discountPct?: number;
  prices?: Partial<Record<StallSize, number>>;
}

/**
 * Which size to price. A browsing request falls back to the scanned sticker's size, then M. A basket line
 * (strict) must be priced at its own size: a size with no stall price is refused, never re-priced.
 */
export function resolveStallSize(requested: string | null | undefined, pricedSizes: StallSize[], scannedSize: string | null | undefined, strict: boolean): StallSize | null {
  const want = (requested || '').toUpperCase();
  if (pricedSizes.includes(want as StallSize)) return want as StallSize;
  if (strict) return null;
  if (scannedSize && pricedSizes.includes(scannedSize as StallSize)) return scannedSize as StallSize;
  return 'M';
}

export async function getStallOffer(request: NextRequest, imageId: string, requestedSize?: string | null, opts: { strictSize?: boolean } = {}): Promise<StallOffer> {
  // Only a print whose sticker this shopper scanned (pt_stall); the last scan in pt_qr still gives the scanId
  const attr = decodeAttribution(request.cookies.get(QR_ATTRIBUTION_COOKIE)?.value);
  const strict = !!opts.strictSize;
  const scan = resolveScannedEntry({
    cookieValue: request.cookies.get(STALL_SCAN_COOKIE)?.value, attr, imageId, requestedSize, strict, now: Date.now(),
  });
  if (!scan) return { available: false, reason: 'not_scanned' };

  const supabase = serviceClient();
  const { data: loc } = await supabase
    .from('stock_locations').select('id, code, name, location_type, is_active, at_market_discount_pct')
    .eq('id', scan.locationId).maybeSingle();
  if (!loc?.is_active || !['stall', 'partner', 'other'].includes(loc.location_type)) return { available: false, reason: 'location_inactive' };

  const { data: image } = await supabase.from('image_catalog').select('id, is_public').eq('id', imageId).maybeSingle();
  if (!image || image.is_public === false) return { available: false, reason: 'image_unavailable' };

  const [prices, onlinePct] = await Promise.all([getSetting('stall_prices_pence'), getSetting('stall_online_discount_pct')]);
  const sizes = STALL_SIZES.filter(s => Number((prices as any)[s]) > 0);
  const size = resolveStallSize(strict ? requestedSize : (scan.size ?? requestedSize), sizes, scan.size, strict);
  if (!size) return { available: false, reason: 'size_not_priced' };
  const discountPct = Math.max(Number(onlinePct) || 0, Number(loc.at_market_discount_pct) || 0);
  const listPricePence = Number((prices as Record<string, number>)[size]) || prices.M;
  const pricePence = Math.round(listPricePence * (1 - discountPct / 100));

  return {
    available: true, locationId: loc.id, locationCode: loc.code, locationName: loc.name, scanId: attr?.scanId,
    size, listPricePence, pricePence, discountPct, prices,
  };
}
