'use client';

import { useEffect, useMemo, useState } from 'react';
import { basketStallSummary, multibuyMessage, stallMultibuySaving, type MultibuyTier } from '@/lib/stall/multibuy';

let cached: { tiers: MultibuyTier[]; at: number } | null = null;
/** How long tiers are trusted in the browser; the checkout page always asks again when it opens. */
export const MULTIBUY_TIERS_TTL_MS = 60_000;

/**
 * The stall multi-buy tiers from the settings. Off until they arrive (and if the fetch fails), so a page never
 * shows or takes off more than the server will. Same functions as the server (lib/stall/multibuy.ts).
 */
export function useMultibuyTiers(opts: { refetchOnMount?: boolean } = {}): MultibuyTier[] {
  const fresh = () => !!cached && Date.now() - cached.at < MULTIBUY_TIERS_TTL_MS;
  const [tiers, setTiers] = useState<MultibuyTier[]>(cached?.tiers ?? []);
  useEffect(() => {
    if (fresh() && !opts.refetchOnMount) { setTiers(cached!.tiers); return; }
    let live = true;
    fetch('/api/public/stall-multibuy', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (j && Array.isArray(j.tiers)) {
          cached = { tiers: j.tiers.filter((t: any) => Number.isInteger(t?.count) && Number.isInteger(t?.savingPence)), at: Date.now() };
          if (live) setTiers(cached.tiers);
        }
      })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  return tiers;
}

/** The basket's multi-buy figures: prints counted, pence saved (capped at what the prints cost) and the note to show. */
export function useStallMultibuy(items: Array<{ productId?: string | null; quantity?: number; pricing?: { sale_price?: number } | null }>, opts: { refetchOnMount?: boolean } = {}) {
  const tiers = useMultibuyTiers(opts);
  return useMemo(() => {
    const { count, subtotalPence } = basketStallSummary(items);
    return { tiers, stallCount: count, savingPence: stallMultibuySaving(count, subtotalPence, tiers), message: multibuyMessage(count, tiers, subtotalPence) };
  }, [items, tiers]);
}
