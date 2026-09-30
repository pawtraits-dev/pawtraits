/**
 * Which products can go on which designs (client-safe).
 *
 * A product belongs to a shape family rather than to one format:
 *   rect_2x3 → portrait 2:3 and landscape 3:2 designs (printed turned to match the design)
 *   square   → 1:1 designs
 *   wide     → 2:1 designs (mugs)
 *   any      → every design (digital downloads)
 * Legacy products without a family still match their single `format_id`.
 */

export type ShapeFamily = 'rect_2x3' | 'square' | 'wide' | 'any';

export const SHAPE_FAMILIES: Array<{ id: ShapeFamily; label: string; ratios: string[]; hint: string }> = [
  { id: 'rect_2x3', label: 'Portrait & landscape', ratios: ['2:3', '3:2'], hint: 'Offered on 2:3 portrait and 3:2 landscape designs. Enter the portrait size; landscape designs print turned.' },
  { id: 'square', label: 'Square', ratios: ['1:1'], hint: 'Offered on 1:1 designs.' },
  { id: 'wide', label: 'Wide (mugs)', ratios: ['2:1'], hint: 'Offered on 2:1 designs.' },
  { id: 'any', label: 'All designs', ratios: [], hint: 'Offered on every design — for digital downloads.' },
];

export function familyForRatio(ratio?: string | null): ShapeFamily | null {
  const r = (ratio || '').trim().replace('/', ':');
  return (SHAPE_FAMILIES.find(f => f.ratios.includes(r))?.id as ShapeFamily) ?? null;
}

export function familyLabel(family?: string | null): string {
  return SHAPE_FAMILIES.find(f => f.id === family)?.label ?? 'Single format (legacy)';
}

/**
 * Does this product go on a design with this format?
 * Uses `format_ids` (added by the product APIs) when present, else the legacy single format.
 */
export function productMatchesFormat(product: { format_id?: string | null; format_ids?: string[] | null; shape_family?: string | null }, formatId?: string | null): boolean {
  if (product.shape_family === 'any') return true;
  if (!formatId) return false;
  if (Array.isArray(product.format_ids)) return product.format_ids.includes(formatId);
  return product.format_id === formatId;
}

/** Formats a product is offered on, given all formats (server adds this to product API responses). */
export function formatIdsForProduct(product: { format_id?: string | null; shape_family?: string | null }, formats: Array<{ id: string; aspect_ratio: string; is_active?: boolean | null }>): string[] {
  if (product.shape_family === 'any') return formats.map(f => f.id);
  if (product.shape_family) return formats.filter(f => familyForRatio(f.aspect_ratio) === product.shape_family).map(f => f.id);
  return product.format_id ? [product.format_id] : [];
}

/** Size to show for a design's orientation, e.g. "20×30 cm" or "30×20 cm". */
export function orientedSize(product: { width_cm?: number | null; height_cm?: number | null }, orientation?: 'portrait' | 'landscape' | 'square' | null): string {
  const w = Number(product.width_cm), h = Number(product.height_cm);
  if (!w || !h) return '';
  const short = Math.min(w, h), long = Math.max(w, h);
  return orientation === 'landscape' ? `${long}×${short} cm` : `${short}×${long} cm`;
}
