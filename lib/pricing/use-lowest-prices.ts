'use client';

import { useEffect, useState } from 'react';

/**
 * Current lowest UK prices, read from the live catalogue (/api/public/products and
 * /api/public/pricing) so copy such as "Prints from £15" never needs a hard-coded figure.
 * Fetched once per page load and shared by every component that uses the hook.
 */
import { EMPTY_PRICES as EMPTY, computeLowestPrices, gbp, type LowestPrices } from './lowest-prices';
export { computeLowestPrices, gbp };
export type { LowestPrices };

let cached: Promise<LowestPrices> | null = null;

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
