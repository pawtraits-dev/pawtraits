/**
 * Lowest current UK prices, from products and their pricing rows (pure; no React). Used by the
 * useLowestPrices hook (client) and by emails that say "from £X" (lib/offers/send.ts), so copy never needs a hard-coded figure.
 */
export interface LowestPrices {
  /** Lowest current UK price of any active physical product, in pence (null until known) */
  lowestPrint: number | null;
  /** Lowest current UK price of an active digital download, in pence (null until known) */
  lowestDigital: number | null;
}

export const EMPTY_PRICES: LowestPrices = { lowestPrint: null, lowestDigital: null };

/** £15, £7.50 */
export const gbp = (pence: number) => `£${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`;

export function computeLowestPrices(products: any[], pricing: any[]): LowestPrices {
  const price = new Map<string, number>();
  for (const row of pricing) {
    if (row.country_code !== 'GB' || row.is_current === false) continue;
    const v = row.is_on_sale && row.discount_price ? row.discount_price : row.sale_price;
    if (typeof v !== 'number' || v <= 0) continue;
    if (!price.has(row.product_id) || v < price.get(row.product_id)!) price.set(row.product_id, v);
  }
  let lowestPrint: number | null = null;
  let lowestDigital: number | null = null;
  for (const p of products) {
    if (p.is_active === false) continue;
    const v = price.get(p.id);
    if (v === undefined) continue;
    if (p.product_type === 'digital_download') lowestDigital = lowestDigital === null ? v : Math.min(lowestDigital, v);
    else lowestPrint = lowestPrint === null ? v : Math.min(lowestPrint, v);
  }
  return { lowestPrint, lowestDigital };
}

