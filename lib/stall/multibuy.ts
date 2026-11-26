/**
 * Stall multi-buy saving: the more stall prints (the print in hand, "stall_print_S|M|L|XL") in one basket,
 * the more comes off in total. Pure and client-safe: the basket, the checkout and the server all use these
 * same functions, so the price shown is the price charged. The amounts are the admin setting
 * `stall_multibuy_pence` (lib/app-settings.ts), never written in code or copy.
 *
 * Setting shape: { "2": 500, "3": 1500 } = a count of stall prints → the TOTAL saving in pence at that count.
 * The highest count at or below the number of prints applies. {} switches the saving off.
 */
import { isStallProductId } from '@/lib/cart/items';

export interface MultibuyTier { count: number; savingPence: number }

/** The shipped amounts: 2 prints save £5, 3 or more save £15 in total. Used when the setting has no row. */
export const DEFAULT_MULTIBUY_PENCE: Record<string, number> = { '2': 500, '3': 1500 };

/** Error message for an admin write, or null when fine. Whole non-negative pence, counts are integers from 2, a higher count never saves less. */
export function validateMultibuyPence(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'Must be an object of print counts and savings';
  const rows: Array<[number, number]> = [];
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d+$/.test(k) || Number(k) < 2) return `"${k}": the number of prints must be a whole number from 2`;
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) return `${k} prints: the saving must be whole pence, 0 or more`;
    rows.push([Number(k), v]);
  }
  rows.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] < rows[i - 1][1]) return `${rows[i][0]} prints must not save less than ${rows[i - 1][0]} prints`;
  }
  return null;
}

/**
 * Safe read of the setting. Nothing stored (undefined/null) = the default amounts; stored but unusable = off
 * (never guess an amount of money). Returns tiers sorted by count.
 */
export function parseMultibuyTiers(raw: unknown): MultibuyTier[] {
  const value = raw === undefined || raw === null ? DEFAULT_MULTIBUY_PENCE : raw;
  if (validateMultibuyPence(value)) return [];
  return Object.entries(value as Record<string, number>)
    .map(([k, v]) => ({ count: Number(k), savingPence: v }))
    .sort((a, b) => a.count - b.count);
}

/** The uncapped saving the tiers give for a number of stall prints. */
function tierSaving(stallLineCount: number, tiers: MultibuyTier[]): number {
  let saving = 0;
  for (const t of tiers) if (t.count <= stallLineCount) saving = t.savingPence;
  return saving;
}

/** Pence saved for this many stall prints, never more than what those prints cost. */
export function stallMultibuySaving(stallLineCount: number, stallSubtotalPence: number, tiers: MultibuyTier[]): number {
  if (!Number.isFinite(stallLineCount) || !Number.isFinite(stallSubtotalPence)) return 0;
  const n = Math.floor(stallLineCount);
  return Math.max(0, Math.min(tierSaving(n, tiers), Math.max(0, Math.round(stallSubtotalPence))));
}

export interface MultibuyStep { addOne: true; totalSavingAfter: number; extraSaving: number }

/** What one more stall print would earn, or null (no prints yet, or one more changes nothing). */
export function nextMultibuyStep(stallLineCount: number, tiers: MultibuyTier[]): MultibuyStep | null {
  const n = Math.floor(stallLineCount);
  if (!(n >= 1)) return null;
  const now = tierSaving(n, tiers);
  const after = tierSaving(n + 1, tiers);
  return after > now ? { addOne: true, totalSavingAfter: after, extraSaving: after - now } : null;
}

/** Extra pence off when one more stall print (costing newPrintPence) joins a basket that already has these. */
export function marginalMultibuySaving(existingCount: number, existingSubtotalPence: number, newPrintPence: number, tiers: MultibuyTier[]): number {
  return stallMultibuySaving(existingCount + 1, existingSubtotalPence + newPrintPence, tiers) - stallMultibuySaving(existingCount, existingSubtotalPence, tiers);
}

/** The stall prints in a basket: how many lines and what they cost (a stall line is always quantity 1). */
export function basketStallSummary(items: Array<{ productId?: string | null; quantity?: number; pricing?: { sale_price?: number } | null }>): { count: number; subtotalPence: number } {
  let count = 0, subtotalPence = 0;
  for (const i of items) {
    if (!isStallProductId(i.productId)) continue;
    count++;
    subtotalPence += (i.pricing?.sale_price || 0) * (i.quantity || 1);
  }
  return { count, subtotalPence };
}

const pounds = (p: number) => `£${(p / 100).toFixed(p % 100 === 0 ? 0 : 2)}`;
const ORDINALS: Record<number, string> = { 3: 'third', 4: 'fourth', 5: 'fifth', 6: 'sixth', 7: 'seventh', 8: 'eighth', 9: 'ninth', 10: 'tenth' };

/** The calm note under the basket, checkout summary and buy sheet; null when there is nothing to say. */
export function multibuyMessage(stallLineCount: number, tiers: MultibuyTier[]): string | null {
  const n = Math.floor(stallLineCount);
  if (!(n >= 1)) return null;
  const saving = tierSaving(n, tiers);
  const step = nextMultibuyStep(n, tiers);
  const scan = 'Scan the sticker on the back of it.';
  if (step && saving === 0) return `Add another print from the stall and save ${pounds(step.totalSavingAfter)}. ${scan}`;
  if (step) return `You're saving ${pounds(saving)}. Add ${n + 1 in ORDINALS ? `a ${ORDINALS[n + 1]}` : 'another'} print and save ${pounds(step.totalSavingAfter)} in total. ${scan}`;
  if (saving > 0) return `Multi-buy: you're saving ${pounds(saving)}.`;
  return null;
}
