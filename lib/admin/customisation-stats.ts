/**
 * Admin > Customisations: customer customisations (customer_custom_images) with what became of
 * them: bought (a paid order line whose image_id is the customisation), shared (the owner tapped
 * Share, or someone opened the shared link) and rated. Server only.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface CustomRow {
  id: string;
  created_at: string;
  status: string;
  catalog_image_id: string | null;
  pet_breed_id: string | null;
  customer_email: string | null;
  guest_session_id: string | null;
  share_count: number | null;
  rating: number | null;
  metadata: any;
}

export interface Outcome {
  purchased: boolean;
  orders: number;
  revenue: Record<string, number>; // minor units by currency
  shares: number;                  // times the owner shared it
  views: number;                   // visits to the shared link
}

const CHUNK = 200;
const chunks = <T,>(list: T[], n = CHUNK) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));
const PAID_EXCLUDED = new Set(['cancelled', 'canceled', 'refunded']);

/** Every customisation made since `since` (ISO), newest first */
export async function loadCustomisations(supabase: SupabaseClient, since: string | null, cap = 50_000): Promise<CustomRow[]> {
  const out: CustomRow[] = [];
  for (let from = 0; from < cap; from += 1000) {
    let q = supabase.from('customer_custom_images')
      .select('id, created_at, status, catalog_image_id, pet_breed_id, customer_email, guest_session_id, share_count, rating, metadata')
      .order('created_at', { ascending: false })
      .range(from, from + 999);
    if (since) q = q.gte('created_at', since);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as CustomRow[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** Purchases and shares for these customisations */
export async function loadOutcomes(supabase: SupabaseClient, rows: { id: string; share_count: number | null }[]): Promise<Map<string, Outcome>> {
  const out = new Map<string, Outcome>(rows.map(r => [r.id, { purchased: false, orders: 0, revenue: {}, shares: 0, views: r.share_count ?? 0 }]));
  const ids = rows.map(r => r.id);
  if (!ids.length) return out;

  const lines: { image_id: string; order_id: string; total_price: number | null; unit_price: number | null; quantity: number | null }[] = [];
  const events: { custom_image_id: string }[] = [];
  await Promise.all(chunks(ids).map(async part => {
    const [li, ev] = await Promise.all([
      supabase.from('order_items').select('image_id, order_id, total_price, unit_price, quantity').in('image_id', part),
      supabase.from('custom_image_events').select('custom_image_id').eq('event', 'share').in('custom_image_id', part),
    ]);
    lines.push(...((li.data ?? []) as any[]));
    events.push(...((ev.data ?? []) as any[])); // empty until the 2026-10-19 migration has run
  }));

  const orderIds = Array.from(new Set(lines.map(l => l.order_id)));
  const orders = new Map<string, { paid: boolean; currency: string }>();
  await Promise.all(chunks(orderIds).map(async part => {
    const { data } = await supabase.from('orders').select('id, status, payment_status, currency').in('id', part);
    for (const o of data ?? []) {
      orders.set(o.id, { paid: o.payment_status === 'paid' && !PAID_EXCLUDED.has(String(o.status || '').toLowerCase()), currency: (o.currency || 'GBP').toUpperCase() });
    }
  }));

  const seenOrder = new Map<string, Set<string>>();
  for (const l of lines) {
    const o = orders.get(l.order_id);
    const r = out.get(l.image_id);
    if (!o?.paid || !r) continue;
    r.purchased = true;
    const set = seenOrder.get(l.image_id) ?? new Set<string>();
    set.add(l.order_id);
    seenOrder.set(l.image_id, set);
    r.orders = set.size;
    const amount = l.total_price ?? (l.unit_price ?? 0) * (l.quantity ?? 1);
    r.revenue[o.currency] = (r.revenue[o.currency] ?? 0) + amount;
  }
  for (const e of events) {
    const r = out.get(e.custom_image_id);
    if (r) r.shares += 1;
  }
  return out;
}

export const wasShared = (o?: Outcome) => !!o && (o.shares > 0 || o.views > 0);

/** Where the breed came from: the saved pet, detected from the photo, or not known */
export function breedSource(r: Pick<CustomRow, 'pet_breed_id' | 'metadata'>): 'profile' | 'detected' | 'unmatched' | 'unknown' {
  const m = r.metadata ?? {};
  if (r.pet_breed_id) return m.breed_source === 'detected' ? 'detected' : 'profile';
  return m.detected_breed ? 'unmatched' : 'unknown';
}

/** Running totals for one group (a design, a breed, a source or everything) */
export interface Bucket {
  customisations: number;
  completed: number;
  failed: number;
  purchased: number;
  orders: number;
  revenue: number;      // primary currency, minor units
  shared: number;
  shares: number;
  views: number;
  ratingSum: number;
  ratingCount: number;
  people: Set<string>;
}

export const emptyBucket = (): Bucket => ({ customisations: 0, completed: 0, failed: 0, purchased: 0, orders: 0, revenue: 0, shared: 0, shares: 0, views: 0, ratingSum: 0, ratingCount: 0, people: new Set() });

export function add(b: Bucket, r: CustomRow, o: Outcome | undefined, currency: string) {
  b.customisations += 1;
  if (r.status === 'complete') b.completed += 1;
  if (r.status === 'failed') b.failed += 1;
  const who = r.customer_email?.toLowerCase() || r.guest_session_id;
  if (who) b.people.add(who);
  if (r.rating) { b.ratingSum += r.rating; b.ratingCount += 1; }
  if (!o) return;
  if (o.purchased) { b.purchased += 1; b.orders += o.orders; b.revenue += o.revenue[currency] ?? 0; }
  if (wasShared(o)) b.shared += 1;
  b.shares += o.shares;
  b.views += o.views;
}

/** A bucket as JSON, with rates worked out (conversion and share rate are of completed ones) */
export function finish(b: Bucket) {
  const { people, ratingSum, ratingCount, ...rest } = b;
  return {
    ...rest,
    people: people.size,
    conversion: b.completed ? b.purchased / b.completed : 0,
    shareRate: b.completed ? b.shared / b.completed : 0,
    rating: ratingCount ? ratingSum / ratingCount : null,
    ratingCount,
  };
}
export type BucketJson = ReturnType<typeof finish>;
