/**
 * Delivery charges (client-safe). Self-printed and posted with Royal Mail Tracked.
 *
 * One flat charge per order by destination, whatever the size or number of prints.
 * To change a charge or add a country, edit this file.
 */

export type ShippingZone = 'GB' | 'EUROPE' | 'US';

export const SHIPPING_ZONES: Record<ShippingZone, { label: string; pricePence: number; service: string; days: string }> = {
  GB: { label: 'UK', pricePence: 500, service: 'Royal Mail Tracked 48', days: '2-3' },
  EUROPE: { label: 'Europe', pricePence: 1000, service: 'Royal Mail International Tracked', days: '3-7' },
  US: { label: 'USA', pricePence: 1500, service: 'Royal Mail International Tracked', days: '5-10' },
};

/** Countries we deliver to (checkout dropdown and the Apple Pay / Google Pay address sheet) */
export const EUROPE_COUNTRIES = ['IE', 'FR', 'DE', 'ES', 'IT', 'NL', 'BE', 'LU', 'AT', 'PT', 'DK', 'SE', 'FI', 'NO', 'CH', 'PL', 'CZ', 'GR'];
export const DELIVERY_COUNTRIES = ['GB', ...EUROPE_COUNTRIES, 'US'];

export function shippingZoneFor(country?: string | null): ShippingZone | null {
  const c = (country || '').trim().toUpperCase();
  if (c === 'GB' || c === 'UK') return 'GB';
  if (c === 'US') return 'US';
  if (EUROPE_COUNTRIES.includes(c)) return 'EUROPE';
  return null;
}

/** Tracked delivery for an order to this country, or null if we don't deliver there */
export function shippingQuoteFor(country?: string | null) {
  const zone = shippingZoneFor(country);
  if (!zone) return null;
  const z = SHIPPING_ZONES[zone];
  return {
    id: `rm_tracked_${zone.toLowerCase()}`,
    name: 'Tracked delivery',
    description: `${z.service} — usually ${z.days} working days after dispatch`,
    price: z.pricePence,
    currency: 'GBP',
    estimatedDeliveryDays: z.days,
    carrier: 'Royal Mail',
    service: z.service,
    hasTracking: true,
  };
}

/** e.g. "UK £5 · Europe £10 · USA £15" */
export function shippingSummary(): string {
  return (Object.values(SHIPPING_ZONES)).map(z => `${z.label} £${(z.pricePence / 100).toFixed(z.pricePence % 100 ? 2 : 0)}`).join(' · ');
}
