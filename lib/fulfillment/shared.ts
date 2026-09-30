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

/** Where an order sits in the fulfilment queue (null = nothing to post). */
export function fulfilmentStage(order: any): FulfilmentStage | null {
  if (!needsPosting(order)) return null;
  if (order.status === 'on_hold') return 'on_hold';
  if (order.fulfillment_provider === 'gelato' || order.gelato_order_id) return 'gelato';
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
