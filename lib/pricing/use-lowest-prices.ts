'use client';

import { useEffect, useState } from 'react';

/**
 * Current lowest UK prices, read from the live catalogue (/api/public/products and
 * /api/public/pricing) so copy such as "Prints from £15" never needs a hard-coded figure.
 * Fetched once per page load and shared by every component that uses the hook.
 */
export interface LowestPrices {
  /** Lowest current UK price of any active physical product, in pence (null until known) */
  lowestPrint: number | null;
  /** Lowest current UK price of an active digital download, in pence (null until known) */
  lowestDigital: number | null;
}

const EMPTY: LowestPrices = { lowestPrint: null, lowestDigital: null };
let cached: Promise<LowestPrices> | null = null;

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

async function load(): Promise<LowestPrices> {
  const [productsRes, pricingRes] = await Promise.all([fetch('/api/public/products'), fetch('/api/public/pricing')]);
  if (!productsRes.ok || !pricingRes.ok) return EMPTY;
  const [products, pricing] = await Promise.all([productsRes.json(), pricingRes.json()]);
  const list = Array.isArray(products) ? products : (products?.products ?? []);
  return computeLowestPrices(list, Array.isArray(pricing) ? pricing : []);
}

export function useLowestPrices(): LowestPrices {
  const [prices, setPrices] = useState<LowestPrices>(EMPTY);
  useEffect(() => {
    let live = true;
    cached ??= load().catch(() => EMPTY);
    cached.then(p => { if (live) setPrices(p); });
    return () => { live = false; };
  }, []);
  return prices;
}
