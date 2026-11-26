'use client';

import { useEffect, useMemo, useState } from 'react';
import { basketStallSummary, multibuyMessage, stallMultibuySaving, type MultibuyTier } from '@/lib/stall/multibuy';

let cached: MultibuyTier[] | null = null;

/**
 * The stall multi-buy tiers from the settings. Off until they arrive (and if the fetch fails), so a page never
 * shows or takes off more than the server will. Same functions as the server (lib/stall/multibuy.ts).
 */
export function useMultibuyTiers(): MultibuyTier[] {
  const [tiers, setTiers] = useState<MultibuyTier[]>(cached ?? []);
  useEffect(() => {
    if (cached) return;
    let live = true;
    fetch('/api/public/stall-multibuy')
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (j && Array.isArray(j.tiers)) {
          cached = j.tiers.filter((t: any) => Number.isInteger(t?.count) && Number.isInteger(t?.savingPence));
          if (live) setTiers(cached!);
        }
      })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  return tiers;
}

/** The basket's multi-buy figures: prints counted, pence saved (capped at what the prints cost) and the note to show. */
export function useStallMultibuy(items: Array<{ productId?: string | null; quantity?: number; pricing?: { sale_price?: number } | null }>) {
  const tiers = useMultibuyTiers();
  return useMemo(() => {
    const { count, subtotalPence } = basketStallSummary(items);
    return { tiers, stallCount: count, savingPence: stallMultibuySaving(count, subtotalPence, tiers), message: multibuyMessage(count, tiers) };
  }, [items, tiers]);
}
