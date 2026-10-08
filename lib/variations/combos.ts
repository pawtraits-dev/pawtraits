import { costOf } from '@/lib/ai/prices';

/**
 * Saved variation batches ("recipes"): which combinations a recipe makes, how each is keyed
 * (so a reference is never given the same combination twice), and what a run costs.
 * Pure functions, shared by the server and the admin pages.
 */

export interface BreedCoat { breedId: string; coatId: string }
export interface Recipe { breedCoats: BreedCoat[]; outfitIds: string[] }
export interface Combo { key: string; breedId: string | null; coatId: string | null; outfitId: string | null }

/** Stable key for one combination; the same for batch runs and the variations window */
export function variationKey(c: { breedId?: string | null; coatId?: string | null; outfitId?: string | null; formatId?: string | null }): string {
  const parts: string[] = [];
  if (c.breedId) parts.push(`b:${c.breedId}`);
  if (c.coatId) parts.push(`c:${c.coatId}`);
  if (c.outfitId) parts.push(`o:${c.outfitId}`);
  if (c.formatId) parts.push(`f:${c.formatId}`);
  return parts.join('|');
}

/**
 * Every combination a recipe makes. Breed/coats and outfits are combined (each breed/coat
 * wears each outfit); with only one list, each entry is one variation of the reference.
 */
export function combosFor(recipe: Recipe): Combo[] {
  const seenBc = new Set<string>();
  const bcs = recipe.breedCoats.filter((bc) => bc.breedId && bc.coatId && !seenBc.has(`${bc.breedId}:${bc.coatId}`) && seenBc.add(`${bc.breedId}:${bc.coatId}`));
  const outfits = Array.from(new Set(recipe.outfitIds.filter(Boolean)));
  const combos: Combo[] = [];
  if (bcs.length && outfits.length) {
    for (const bc of bcs) for (const o of outfits) combos.push({ breedId: bc.breedId, coatId: bc.coatId, outfitId: o, key: '' });
  } else if (bcs.length) {
    for (const bc of bcs) combos.push({ breedId: bc.breedId, coatId: bc.coatId, outfitId: null, key: '' });
  } else {
    for (const o of outfits) combos.push({ breedId: null, coatId: null, outfitId: o, key: '' });
  }
  for (const c of combos) c.key = variationKey(c);
  return combos;
}

export function recipeSize(recipe: Recipe): number {
  return combosFor(recipe).length;
}

/**
 * Estimated cost of one batch image (USD): the image at batch price plus a typical prompt,
 * reference photo and thinking. Real costs are recorded per image in AI costs.
 */
export function estimateBatchImageCost(model: string, imageSize: string): number {
  const imageTokens: Record<string, number> = { '1K': 1120, '2K': 1680, '4K': 3780 };
  const c = costOf(model, { inputTokens: 2600, outputTextTokens: 20, thinkingTokens: 1000, outputImageTokens: imageTokens[imageSize] ?? 1680 }, true);
  return c?.total ?? 0;
}

/** Split items into Gemini jobs of at most `size` (keeps result files a manageable size) */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Item states that mean "this combination exists or is on its way" for a reference */
export const TAKEN_ITEM_STATES = ['queued', 'submitted', 'generated', 'approved'] as const;

/**
 * What a run would make for one reference: combinations not already in the catalogue for it
 * and not already queued or waiting for review. Rejected and failed ones are made again.
 */
export function plan(combos: Combo[], existingKeys: Set<string>): { make: Combo[]; skipped: number } {
  const make = combos.filter((c) => !existingKeys.has(c.key));
  return { make, skipped: combos.length - make.length };
}

/** Gemini Batch maps job states to ours */
export function jobStateFromGemini(state?: string | null): 'running' | 'succeeded' | 'failed' | 'cancelled' | 'expired' {
  switch (state) {
    case 'JOB_STATE_SUCCEEDED': return 'succeeded';
    case 'JOB_STATE_FAILED': return 'failed';
    case 'JOB_STATE_CANCELLED': return 'cancelled';
    case 'JOB_STATE_EXPIRED': return 'expired';
    default: return 'running';
  }
}

/** A design's description as a short plain title (descriptions start with **Title** in markdown) */
export function plainTitle(text?: string | null, fallback = 'Design'): string {
  const t = (text ?? '').replace(/\*\*/g, '').replace(/[#_`]/g, '').replace(/\s+/g, ' ').trim();
  return t ? (t.length > 80 ? `${t.slice(0, 79)}…` : t) : fallback;
}
