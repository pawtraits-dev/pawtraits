/**
 * Shared cart-item helpers (client + server safe — no DB access).
 *
 * Stall "take it home now" prints live in the same basket as everything else, as a
 * pseudo-product "stall_print_S|M|L" (no products row). The server re-prices them from
 * admin settings and checks the customer scanned a stall sticker (lib/stall/offer.ts).
 */
export const STALL_PRODUCT_PREFIX = 'stall_print_';
export const SIZE_NAMES: Record<string, string> = { S: 'Small', M: 'Medium', L: 'Large' };

export function isStallProductId(productId?: string | null): boolean {
  return !!productId && /^stall_print_[SML]$/.test(productId);
}
export function stallSizeFromProductId(productId: string): 'S' | 'M' | 'L' | null {
  const m = /^stall_print_([SML])$/.exec(productId);
  return (m?.[1] as 'S' | 'M' | 'L') ?? null;
}

/** product/pricing objects shaped like real ones so the basket, cart page and checkout work unchanged */
export function buildStallCartProduct(size: 'S' | 'M' | 'L', pricePence: number) {
  const id = `${STALL_PRODUCT_PREFIX}${size}`;
  return {
    product: {
      id,
      name: `Ready-made ${SIZE_NAMES[size].toLowerCase()} print — take home now`,
      sku: id,
      product_type: 'stall_print',
      fulfillment_method: 'collected',
      requires_shipping: false,
      size_code: size,
      size_name: SIZE_NAMES[size],
      is_active: true,
    },
    pricing: {
      id: `stall_${size}`,
      product_id: id,
      country_code: 'GB',
      sale_price: pricePence,
      currency_code: 'GBP',
      currency_symbol: '£',
    },
  };
}

/** Does this basket line need posting to the customer? */
export function itemNeedsShipping(item: { productId?: string; product?: any }): boolean {
  if (isStallProductId(item.productId)) return false;
  const t = item.product?.product_type;
  if (t === 'digital_download' || t === 'stall_print') return false;
  if (item.product?.requires_shipping === false) return false;
  return true;
}

/** One human line describing the option (size/finish), for basket, checkout and emails. */
export function describeCartItem(item: { productId?: string; product?: any }): string {
  const p = item.product || {};
  if (isStallProductId(item.productId) || p.product_type === 'stall_print') {
    return `Ready-made ${SIZE_NAMES[p.size_code] || ''} print · take home now`.replace('  ', ' ');
  }
  if (p.product_type === 'digital_download') return 'Digital download · high resolution';
  const medium = p.medium?.name || p.media_name || '';
  const size = p.size_name || '';
  const dims = p.width_cm && p.height_cm ? `${p.width_cm}×${p.height_cm} cm` : '';
  return [medium, [size, dims].filter(Boolean).join(' ')].filter(Boolean).join(' · ') || p.name || 'Print';
}

/** Title for a customised portrait — never the catalogue description (it names the original breed). */
export function customPortraitTitle(petName?: string | null, themeName?: string | null): string {
  const pet = petName && petName !== 'Uploaded Pet' ? petName.trim() : '';
  const theme = themeName ? ` · ${themeName}` : '';
  return pet ? `Custom Pawtrait of ${pet}${theme}` : `Your custom Pawtrait${theme}`;
}

/** Physical prints bought on the website come with a free digital download of the design. */
export function includesFreeDigital(item: { productId?: string; product?: any }): boolean {
  if (isStallProductId(item.productId)) return true;
  const t = item.product?.product_type;
  return t === 'physical_print' || t === 'hybrid' || t === 'stall_print' || (!t && !!item.productId);
}

/** Paid download lines made redundant by a print of the same design in the same basket. */
export function redundantDigitalLines<T extends { productId?: string; imageId: string; product?: any }>(items: T[]): T[] {
  const withPrint = new Set(items.filter(i => includesFreeDigital(i)).map(i => i.imageId));
  return items.filter(i => i.product?.product_type === 'digital_download' && withPrint.has(i.imageId));
}
