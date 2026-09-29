import type { NextRequest } from 'next/server';
import { QR_ATTRIBUTION_COOKIE, decodeAttribution } from '@/lib/qr/attribution';
import { getSetting } from '@/lib/app-settings';
import { serviceClient } from '@/lib/qr/server';

/** A stall "take it home now" offer is only shown to someone who scanned a located sticker recently. */
export const STALL_SCAN_FRESH_HOURS = 12;

export interface StallOffer {
  available: boolean;
  reason?: string;
  locationId?: string;
  locationCode?: string;
  locationName?: string;
  scanId?: string;
  size?: 'S' | 'M' | 'L';
  listPricePence?: number;
  pricePence?: number;
  discountPct?: number;
  prices?: Record<'S' | 'M' | 'L', number>;
}

export async function getStallOffer(request: NextRequest, imageId: string, requestedSize?: string | null): Promise<StallOffer> {
  const attr = decodeAttribution(request.cookies.get(QR_ATTRIBUTION_COOKIE)?.value);
  if (!attr?.locationId) return { available: false, reason: 'no_stall_scan' };
  if (Date.now() - attr.ts > STALL_SCAN_FRESH_HOURS * 3600_000) return { available: false, reason: 'scan_too_old' };

  const supabase = serviceClient();
  const { data: loc } = await supabase
    .from('stock_locations').select('id, code, name, location_type, is_active, at_market_discount_pct')
    .eq('id', attr.locationId).maybeSingle();
  if (!loc?.is_active || !['stall', 'partner', 'other'].includes(loc.location_type)) return { available: false, reason: 'location_inactive' };

  const { data: image } = await supabase.from('image_catalog').select('id, is_public').eq('id', imageId).maybeSingle();
  if (!image || image.is_public === false) return { available: false, reason: 'image_unavailable' };

  const [prices, onlinePct] = await Promise.all([getSetting('stall_prices_pence'), getSetting('stall_online_discount_pct')]);
  const size = (['S', 'M', 'L'].includes((requestedSize || '').toUpperCase()) ? requestedSize!.toUpperCase()
    : attr.size && ['S', 'M', 'L'].includes(attr.size) ? attr.size : 'M') as 'S' | 'M' | 'L';
  const discountPct = Math.max(Number(onlinePct) || 0, Number(loc.at_market_discount_pct) || 0);
  const listPricePence = prices[size];
  const pricePence = Math.round(listPricePence * (1 - discountPct / 100));

  return {
    available: true, locationId: loc.id, locationCode: loc.code, locationName: loc.name, scanId: attr.scanId,
    size, listPricePence, pricePence, discountPct, prices,
  };
}
