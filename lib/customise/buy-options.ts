/**
 * Pure rules for the buy options on the design page (client-safe, no network).
 * Used by components/customise/BuyOptionsSheet.tsx; tested in scripts/test-scan-page.ts.
 */

/** Id of the "print in your hand" option (the stall's ready-made print) */
export const STALL_OPTION = '__stall__';

export interface BuyRow {
  id: string;
  product_type: string;
  size_code?: string;
  media_name?: string;
  medium?: { name?: string } | null;
}

/** Foamex (the stall's prints) */
export const isFoamRow = (p: BuyRow) => /foam/i.test(p.media_name || p.medium?.name || '');

export const gbp = (v?: number) => (v === undefined ? '' : `£${(v / 100).toFixed(v % 100 === 0 ? 0 : 2)}`);

export interface DefaultSelectionInput {
  rows: BuyRow[];
  stallAvailable: boolean;
  kind: 'catalog' | 'custom';
  frame: boolean;
  physicalOnly: boolean;
  inline: boolean;
  scannedSize?: string | null;
}

/** What is ticked when the options first appear. A stall scan always starts with the print in hand. */
export function defaultSelection(i: DefaultSelectionInput): string[] {
  if (i.stallAvailable) return [STALL_OPTION];
  const digital = i.rows.find(p => p.product_type === 'digital_download');
  const prints = i.rows.filter(p => p.product_type !== 'digital_download');
  const size = i.scannedSize || 'M';
  const medium = prints.find(p => isFoamRow(p) && p.size_code === size) ?? prints.find(p => p.size_code === size);
  if (i.kind === 'custom' && digital && !i.frame) return [digital.id];
  if (i.inline && medium) return [medium.id];
  if (i.inline && digital && prints.length === 0) return [digital.id];
  if (i.physicalOnly && i.rows.length === 1) return [i.rows[0].id];
  return [];
}

/** The same size in the stall's material (foamex): "the print in your hand" already covers it */
export function isStallSameSize(p: BuyRow, stallSize?: string | null): boolean {
  return !!stallSize && p.product_type !== 'digital_download' && p.size_code === stallSize && isFoamRow(p);
}

/** Made-to-order rows: when the stall option is shown, drop the scanned size in foamex; other materials stay */
export function madeToOrderRows<T extends BuyRow>(rows: T[], stallAvailable: boolean, stallSize?: string | null): T[] {
  return stallAvailable ? rows.filter(p => !isStallSameSize(p, stallSize)) : rows;
}

/** "The print in your hand · Medium + Large · Foamex · £45": what the buttons will buy */
export function selectionLine(labels: string[], totalPence: number): string {
  if (!labels.length) return 'Nothing chosen yet';
  return `${labels.join(' + ')}${totalPence > 0 ? ` · ${gbp(totalPence)}` : ''}`;
}

/** The "print in your hand" option is available: a catalogue design, with a stall size and price */
export function isStallOfferUsable(kind: 'catalog' | 'custom', offer?: { available?: boolean; size?: string; pricePence?: number } | null): boolean {
  return kind === 'catalog' && !!offer?.available && !!offer.size && !!offer.pricePence;
}
