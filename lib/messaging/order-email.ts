/**
 * Shared wording for order emails (confirmation, posted): plain item descriptions, the portrait to
 * show at the top, delivery service and times, full country names. Server only.
 */
import { shippingZoneFor, SHIPPING_ZONES } from '@/lib/shipping/rates';

const STALL_SIZES: Record<string, string> = { S: 'Small', M: 'Medium', L: 'Large' };
const gbp = (pence: number | null | undefined) => (pence == null ? null : `£${(pence / 100).toFixed(2)}`);

const CODE_BY_NAME: Record<string, string> = { 'united kingdom': 'GB', uk: 'GB', 'great britain': 'GB', 'united states': 'US', usa: 'US' };

/** "GB" → "United Kingdom", "DE" → "Germany"; names pass through */
export function countryName(raw: string | null | undefined): string {
  const s = (raw ?? '').trim();
  if (!s) return '';
  const code = /^[A-Za-z]{2}$/.test(s) ? s.toUpperCase() : CODE_BY_NAME[s.toLowerCase()];
  if (!code) return s;
  try { return new Intl.DisplayNames(['en-GB'], { type: 'region' }).of(code) || s; } catch { return s; }
}

export function countryCode(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim();
  if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
  return CODE_BY_NAME[s.toLowerCase()] ?? null;
}

/** "Medium print · 30 × 45 cm · with free digital copy" */
export function describeItem(item: any, opts: { giftEligible: boolean }): string {
  const pd = typeof item.product_data === 'string' ? JSON.parse(item.product_data) : (item.product_data || {});
  if (pd.product_type === 'stall_print') {
    return [`${STALL_SIZES[pd.size_code] ?? ''} print, taken home`.trim(), opts.giftEligible ? 'with free digital copy' : null].filter(Boolean).join(' · ');
  }
  if (pd.product_type === 'digital_download' || item.is_digital) return 'Digital download · full resolution';
  const size = pd.width_cm && pd.height_cm ? `${Number(pd.width_cm)} × ${Number(pd.height_cm)} cm` : null;
  return [pd.size_name ? `${pd.size_name} print` : 'Print', size, opts.giftEligible ? 'with free digital copy' : null].filter(Boolean).join(' · ');
}

export interface OrderEmailItem { title: string; description: string; quantity: number; multiple: boolean; price: string }

export function emailItems(orderItems: any[], giftEligible: boolean): OrderEmailItem[] {
  return (orderItems ?? []).map(i => ({
    title: i.image_title || 'Pawtrait',
    description: describeItem(i, { giftEligible }),
    quantity: i.quantity ?? 1,
    multiple: (i.quantity ?? 1) > 1,
    price: gbp((i.unit_price ?? 0) * (i.quantity ?? 1)) ?? '',
  }));
}

/** First line's portrait (watermarked preview for customised ones), for the top of the email */
export function heroImage(orderItems: any[]): { url: string | null; alt: string } {
  const first = (orderItems ?? []).find(i => i.image_url && /^https:\/\//.test(i.image_url));
  return { url: first?.image_url ?? null, alt: first?.image_title || 'Your Pawtrait' };
}

export function deliveryFor(country: string | null | undefined): { service: string | null; days: string | null } {
  const zone = shippingZoneFor(countryCode(country) ?? country ?? undefined);
  return zone ? { service: SHIPPING_ZONES[zone].service, days: SHIPPING_ZONES[zone].days.replace('-', '–') } : { service: null, days: null };
}

/** "Biscuit’s" / "Biscuit & Luna’s" from a customised portrait title ("Custom Pawtrait of Biscuit & Luna · Royal"), else null */
export function petPossessive(title: string | null | undefined): string | null {
  const NAME = "[A-Za-zÀ-ÖØ-öø-ÿ'’-]{2,20}";
  const m = new RegExp(`^Custom Pawtrait of (${NAME}(?:(?:, | & )${NAME}){0,4})(?= ·|$)`).exec((title ?? '').trim());
  return m ? `${m[1]}’s` : null;
}

/** Delivery window from a posting date and "2–3 working days" (Royal Mail delivers Mon–Sat): "Sat 4 – Mon 6 October" */
export function deliveryWindow(from: Date, eta: string | null | undefined): string | null {
  const m = /(\d+)\s*[–-]\s*(\d+)/.exec(eta ?? '');
  if (!m) return null;
  const add = (n: number) => {
    const d = new Date(from);
    while (n > 0) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0) n--; }
    return d;
  };
  const a = add(Number(m[1])), b = add(Number(m[2]));
  const day = (d: Date, month: boolean) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', ...(month ? { month: 'long' } : {}) });
  return a.getMonth() === b.getMonth() ? `${day(a, false)} – ${day(b, true)}` : `${day(a, true)} – ${day(b, true)}`;
}
