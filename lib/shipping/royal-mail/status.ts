/**
 * Royal Mail parcel tracking stages (client-safe): what we store on orders.tracking_status, the
 * words customers see, and how Royal Mail's tracking events map onto them.
 */
export type TrackingStage =
  | 'label_created' | 'in_transit' | 'out_for_delivery' | 'attempted' | 'awaiting_collection'
  | 'delivered' | 'returned' | 'exception';

export interface TrackingEvent { code: string | null; name: string; at: string; location: string | null }

export const STAGE_TEXT: Record<TrackingStage, { label: string; customer: string }> = {
  label_created: { label: 'Label made', customer: 'Packed and ready to post' },
  in_transit: { label: 'With Royal Mail', customer: 'With Royal Mail and on its way' },
  out_for_delivery: { label: 'Out for delivery', customer: 'Out for delivery today' },
  attempted: { label: 'Delivery attempted', customer: 'Royal Mail tried to deliver it' },
  awaiting_collection: { label: 'Waiting for collection', customer: 'Waiting for you to collect' },
  delivered: { label: 'Delivered', customer: 'Delivered' },
  returned: { label: 'Coming back to us', customer: 'On its way back to us' },
  exception: { label: 'Problem', customer: 'Royal Mail has flagged a problem' },
};

/** Customer progress bar: the four steps (the others sit on step 3 or 4) */
export const PROGRESS = ['label_created', 'in_transit', 'out_for_delivery', 'delivered'] as const;
export function progressIndex(stage: TrackingStage | null | undefined): number {
  switch (stage) {
    case 'delivered': return 3;
    case 'out_for_delivery': case 'attempted': case 'awaiting_collection': return 2;
    case 'in_transit': case 'returned': case 'exception': return 1;
    default: return 0;
  }
}

/** Stages that end tracking (no more checks) */
export const FINAL_STAGES: TrackingStage[] = ['delivered', 'returned'];

/**
 * One event → a stage, from Royal Mail's wording (codes vary by product, the words don't much).
 * Summary statusCategory, when present, is used first (e.g. "DELIVERED", "IN TRANSIT").
 */
export function stageOfEvent(name: string, code?: string | null): TrackingStage {
  const n = name.toLowerCase();
  if (/return(ed|ing)? to sender|being returned|returned to/.test(n)) return 'returned';
  if (/delivered|signed for by/.test(n) && !/not delivered|unable to be delivered|attempt/.test(n)) return 'delivered';
  if (/out for delivery|with your delivery (office|postman)|on its way to you today/.test(n)) return 'out_for_delivery';
  if (/ready (for|to) collect|collect it from|available for collection|held at|waiting for you/.test(n)) return 'awaiting_collection';
  if (/attempted|tried to deliver|something for you|card left|no one (was )?(in|available)|we couldn.t deliver/.test(n)) return 'attempted';
  if (/address (is )?(incomplete|incorrect)|damaged|unable to deliver|undeliverable|delayed|problem|customs.*(held|charge|fee)/.test(n)) return 'exception';
  if (code === 'EVPPA' || /we.ve got it|accepted|received|in transit|processed|sorted|arrived|on its way|despatched|dispatched|left our|departed|forwarded|customs/.test(n)) return 'in_transit';
  return 'in_transit';
}

export function stageOfSummary(category: string | null | undefined): TrackingStage | null {
  const c = String(category || '').toUpperCase();
  if (!c) return null;
  if (c.includes('DELIVERED') && !c.includes('NOT')) return 'delivered';
  if (c.includes('RETURN')) return 'returned';
  if (c.includes('OUT FOR DELIVERY')) return 'out_for_delivery';
  if (c.includes('COLLECT')) return 'awaiting_collection';
  if (c.includes('ATTEMPT')) return 'attempted';
  if (c.includes('TRANSIT') || c.includes('ACCEPTED')) return 'in_transit';
  return null;
}
