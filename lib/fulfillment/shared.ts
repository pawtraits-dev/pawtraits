/**
 * Fulfilment helpers shared by server code and the admin UI (no server-only imports).
 */
import { extractDescriptionTitle } from '@/lib/utils';
import type { FulfilmentStage, SelfPrintStatus } from '@/lib/product-types';

export const SELF_PRINT_STEPS: SelfPrintStatus[] = ['to_print', 'printed', 'packed', 'posted'];

export const STAGE_LABELS: Record<FulfilmentStage, string> = {
  on_hold: 'On hold',
  needs_routing: 'Not routed',
  to_print: 'To print',
  printed: 'Printed',
  packed: 'Packed',
  posted: 'Posted',
  gelato: 'Gelato',
};

/** Postage services offered when marking an order posted. */
export const POSTAGE_SERVICES = [
  { id: 'rm_tracked_48', label: 'Royal Mail Tracked 48', carrier: 'Royal Mail', tracked: true, eta: '2–3 working days' },
  { id: 'rm_tracked_24', label: 'Royal Mail Tracked 24', carrier: 'Royal Mail', tracked: true, eta: '1–2 working days' },
  { id: 'rm_2nd', label: 'Royal Mail 2nd Class', carrier: 'Royal Mail', tracked: false, eta: '2–3 working days' },
  { id: 'rm_1st', label: 'Royal Mail 1st Class', carrier: 'Royal Mail', tracked: false, eta: '1–2 working days' },
  { id: 'rm_special', label: 'Royal Mail Special Delivery', carrier: 'Royal Mail', tracked: true, eta: 'next working day' },
  { id: 'other', label: 'Other courier', carrier: '', tracked: true, eta: 'a few working days' },
] as const;

function parse(v: any) {
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return undefined; }
}

/** Items we post: physical prints (legacy items with no product type count as prints). */
export function isPostedPrintItem(orderItem: { product_data?: any }): boolean {
  const productData = parse(orderItem.product_data);
  const type = productData?.product_type;
  if (type === 'digital_download' || type === 'stall_print') return false;
  if (productData?.fulfillment_method === 'collected') return false;
  return type === 'physical_print' || type === 'hybrid' || type === undefined;
}

/** Items in this order that we post (not downloads, not prints handed over at the stall). */
export function postedItems(order: any): any[] {
  if (order?.fulfillment_type === 'collected') return [];
  return (order?.order_items || []).filter((i: any) => isPostedPrintItem(i));
}

export function needsPosting(order: any): boolean {
  return postedItems(order).length > 0;
}

// ---------------------------------------------------------------------------------------------
// Split by material: which lines we print and post ourselves, which go to Gelato

/** Materials (media slugs) printed here in split mode; used when the setting is missing or broken. */
export const DEFAULT_SELF_PRINT_MATERIALS = ['foamex', 'foam-print'];

export type FulfilmentPart = 'self_print' | 'gelato';

/** The line's material (media slug), trimmed and lower-cased; '' when unknown. */
export function materialOf(item: { product_data?: any }): string {
  const slug = parse(item?.product_data)?.medium?.slug;
  return typeof slug === 'string' ? slug.trim().toLowerCase() : '';
}

/** A usable materials list. A broken setting must never send foamex to Gelato, so it falls back to the default. */
export function cleanMaterials(v: unknown): string[] {
  const out: string[] = [];
  if (Array.isArray(v)) {
    for (const m of v) {
      if (typeof m !== 'string') continue;
      const s = m.trim().toLowerCase();
      if (s && !out.includes(s)) out.push(s);
    }
  }
  return out.length ? out : [...DEFAULT_SELF_PRINT_MATERIALS];
}

export function cleanMode(v: unknown): 'self_print' | 'gelato' | 'split' {
  return v === 'split' || v === 'gelato' || v === 'self_print' ? v : 'self_print';
}

/** Split posted lines by material. A line is never divided; unknown products go to Gelato. */
export function routeOrderItems(order: any, materials: string[]): { selfPrint: any[]; gelato: any[] } {
  const ours = materials.map(m => String(m).trim().toLowerCase());
  const selfPrint: any[] = [];
  const gelato: any[] = [];
  for (const line of postedItems(order)) (ours.includes(materialOf(line)) ? selfPrint : gelato).push(line);
  return { selfPrint, gelato };
}

/** Who makes this line. Orders made before the split have no line marks and follow the order. */
export function itemProvider(order: any, item: any): FulfilmentPart {
  if (item?.fulfillment_provider === 'self_print' || item?.fulfillment_provider === 'gelato') return item.fulfillment_provider;
  return order?.fulfillment_provider === 'gelato' || order?.gelato_order_id ? 'gelato' : 'self_print';
}

/** "Our" lines: posted lines we print and post ourselves. */
export function selfPrintItems(order: any): any[] {
  return postedItems(order).filter(i => itemProvider(order, i) === 'self_print');
}

export function gelatoItems(order: any): any[] {
  return postedItems(order).filter(i => itemProvider(order, i) === 'gelato');
}

export function isSplitOrder(order: any): boolean {
  return selfPrintItems(order).length > 0 && gelatoItems(order).length > 0;
}

/** A split order whose Gelato part has not been sent yet. */
export function gelatoPartWaiting(order: any): boolean {
  return isSplitOrder(order) && !order?.gelato_order_id;
}

/** Why these lines cannot go to Gelato (mirrors GelatoFulfillmentService.canFulfill and its file checks). */
export function gelatoProblems(items: any[]): string[] {
  const out: string[] = [];
  for (const item of items) {
    const p = parse(item?.product_data) || {};
    const label = `${itemTitle(item)} (${describeOrderItem(item)})`;
    if (!p.gelato_sku) out.push(`${label}: no Gelato product set (add it in Products)`);
    if (p.product_type && p.product_type !== 'physical_print') out.push(`${label}: Gelato cannot make this kind of item`);
    if (!item?.print_image_url) out.push(`${label}: no print file`);
    if (item?.print_file_meta?.print_master === 'pending') out.push(`${label}: the large print file is still being made, try again in a few minutes`);
    if (item?.print_file_meta?.print_master === 'failed') out.push(`${label}: the large print file failed, use Rebuild print files`);
  }
  return out;
}

/** Order statuses a split order's progress may overwrite (never on_hold, cancelled, refunded, fulfillment_error ...). */
export const SPLIT_STATUS_OVERWRITABLE = ['confirmed', 'processing', 'shipped', 'delivered'];

/** Order status from how far each half has got. */
export function splitOrderStatus(o: any): {
  status: 'confirmed' | 'processing' | 'shipped' | 'delivered';
  fulfillment_status: 'processing' | 'partially_fulfilled' | 'fulfilled';
} {
  const ours = o?.self_print_status === 'posted' ? (o?.delivered_at ? 2 : 1) : 0;
  const theirs = o?.gelato_status === 'delivered' ? 2 : o?.gelato_status === 'shipped' ? 1 : 0;
  if (ours === 2 && theirs === 2) return { status: 'delivered', fulfillment_status: 'fulfilled' };
  if (ours >= 1 && theirs >= 1) return { status: 'shipped', fulfillment_status: 'fulfilled' };
  if (ours >= 1 || theirs >= 1) return { status: 'processing', fulfillment_status: 'partially_fulfilled' };
  return { status: 'confirmed', fulfillment_status: 'processing' };
}

/** splitOrderStatus, or nothing when the order is in a state it must not overwrite. */
export function splitStatusFields(o: any): Record<string, any> {
  return SPLIT_STATUS_OVERWRITABLE.includes(o?.status) ? splitOrderStatus(o) : {};
}

/** Can print files for this line still be rebuilt (nobody has printed or sent it yet)? */
export function isOpenForPrintFiles(order: any, item: any): boolean {
  if (itemProvider(order, item) === 'gelato') return !order?.gelato_order_id;
  return !['printed', 'packed', 'posted'].includes(order?.self_print_status);
}

export function safeHttpsUrl(v: unknown): string | null {
  if (typeof v !== 'string' || !v.startsWith('https://')) return null;
  try { new URL(v); return v; } catch { return null; }
}

/** Where an order sits in the fulfilment queue (null = nothing to post). A split order sits at its self-print stage. */
export function fulfilmentStage(order: any): FulfilmentStage | null {
  if (!needsPosting(order)) return null;
  if (order.status === 'on_hold') return 'on_hold';
  if (selfPrintItems(order).length === 0)
    return (order.fulfillment_provider === 'gelato' || order.gelato_order_id) ? 'gelato' : 'needs_routing';
  if (order.fulfillment_provider === 'self_print' && order.self_print_status) return order.self_print_status;
  return 'needs_routing';
}

/** e.g. "Foamex · Medium 20×30 cm" */
export function describeOrderItem(item: { product_data?: any }): string {
  const p = parse(item.product_data) || {};
  const medium = p.medium?.name || '';
  const size = p.size_name || '';
  const dims = p.width_cm && p.height_cm ? `${Number(p.width_cm)}×${Number(p.height_cm)} cm` : '';
  return [medium, [size, dims].filter(Boolean).join(' ')].filter(Boolean).join(' · ') || p.name || 'Print';
}

export function itemTitle(item: { image_title?: string }): string {
  return (extractDescriptionTitle(item.image_title) || item.image_title || 'Pawtrait').slice(0, 70);
}

/** Per-item reference printed on the slip, e.g. "PW-1234-2". */
export function itemRef(order: { order_number: string }, index: number): string {
  return `${order.order_number}-${index + 1}`;
}

export function royalMailTrackingUrl(code: string): string {
  return `https://www.royalmail.com/track-your-item#/tracking-results/${encodeURIComponent(code)}`;
}
