/**
 * Split routing (server side, no network of its own).
 *
 * "Split by material": posted lines made of a self-print material (foamex) go to the owner's print queue;
 * every other posted line goes to Gelato. A mixed order is split into two shipments.
 * Needs db/migrations/2026-11-20-foamex-self-print-split.sql (line marks and Gelato tracking columns).
 *
 * Gelato orders cost money, so the Gelato part is sent only when every Gelato line passes gelatoProblems.
 * Half a Gelato order is never sent.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { FulfillmentResult } from './base-fulfillment-service';
import { gelatoProblems, routeOrderItems, safeHttpsUrl, splitStatusFields, SPLIT_STATUS_OVERWRITABLE } from './shared';

export interface SplitRoutingDeps {
  materials: string[];
  /** false = mark only (release from hold) */
  send: boolean;
  /** required when send is true */
  sendGelato?: (order: any, items: any[]) => Promise<FulfillmentResult>;
  /** default true */
  digitalOk?: boolean;
  /** why digital failed (recorded in error_message) */
  digitalError?: string | null;
  /** e.g. { status: 'confirmed' } when releasing */
  extraOrderFields?: Record<string, any>;
}
export type GelatoPartState = 'none' | 'sent' | 'failed' | 'not_sent';
export interface SplitRoutingResult {
  selfPrintIds: string[];
  gelatoIds: string[];
  gelato: GelatoPartState;
  gelatoOrderId: string | null;
  error: string | null;
}

/** True only when both the line marks and the Gelato tracking columns exist (the migration has been run). */
export async function splitColumnsReady(supabase: SupabaseClient): Promise<boolean> {
  try {
    const [a, b] = await Promise.all([
      supabase.from('order_items').select('fulfillment_provider').limit(1),
      supabase.from('orders').select('gelato_tracking_code').limit(1),
    ]);
    return !a.error && !b.error;
  } catch {
    return false;
  }
}

/** The order columns that describe where the order has been sent (pure). */
export function splitRoutingFields(input: {
  selfCount: number;
  gelatoCount: number;
  gelato: GelatoPartState;
  gelatoOrderId?: string | null;
  error?: string | null;
  digitalOk: boolean;
  /** why the download part failed; kept in error_message (as the old router path did) */
  digitalError?: string | null;
}): Record<string, any> {
  const { selfCount, gelato } = input;
  let fulfillment_status: string =
    selfCount > 0 ? 'processing' : gelato === 'sent' ? 'fulfilled' : gelato === 'not_sent' ? 'pending' : 'failed';
  if (!input.digitalOk && (fulfillment_status === 'processing' || fulfillment_status === 'fulfilled')) fulfillment_status = 'partially_fulfilled';
  return {
    fulfillment_provider: selfCount > 0 ? 'self_print' : gelato === 'sent' ? 'gelato' : null,
    self_print_status: selfCount > 0 ? 'to_print' : null,
    ...(gelato === 'sent' ? { gelato_order_id: input.gelatoOrderId ?? null, gelato_status: 'pending' } : {}),
    error_message: ((): string | null => {
      const parts = [
        input.digitalOk ? null : (input.digitalError || 'Download delivery failed'),
        gelato === 'none' || gelato === 'sent' ? null : (input.error ?? null),
      ].filter(Boolean) as string[];
      return parts.length ? parts.join(' | ').slice(0, 1000) : null;
    })(),
    fulfillment_status,
  };
}

async function updateOrder(supabase: SupabaseClient, orderId: string, fields: Record<string, any>) {
  const stamp = { updated_at: new Date().toISOString() };
  let { error } = await supabase.from('orders').update({ ...fields, ...stamp } as any).eq('id', orderId);
  if (error && /fulfillment_provider|self_print_status/.test(error.message || '')) {
    // Self-print migration not run yet: still record the rest
    const { fulfillment_provider, self_print_status, ...rest } = fields;
    ({ error } = await supabase.from('orders').update({ ...rest, ...stamp } as any).eq('id', orderId));
  }
  if (error) console.error('[Split routing] Failed to update the order:', error.message);
}

async function auditSplit(supabase: SupabaseClient, orderId: string, method: string, status: string, message: string) {
  try {
    await supabase.from('order_fulfillment_tracking').insert({
      order_id: orderId, fulfillment_method: method, status, status_message: message.slice(0, 500),
    });
  } catch (e) {
    console.warn('[Split routing] audit write failed (non-critical)');
  }
}

/**
 * Mark each posted line (self_print or gelato), send the Gelato part when allowed, and record the result on the order.
 */
export async function applySplitRouting(supabase: SupabaseClient, order: any, items: any[], deps: SplitRoutingDeps): Promise<SplitRoutingResult> {
  const digitalOk = deps.digitalOk !== false;
  const extra = deps.extraOrderFields ?? {};
  const full = { ...order, order_items: items };
  const { selfPrint, gelato } = routeOrderItems(full, deps.materials);
  const selfIds = selfPrint.map((i: any) => i.id);
  const gelatoIds = gelato.map((i: any) => i.id);
  const result: SplitRoutingResult = { selfPrintIds: selfIds, gelatoIds, gelato: 'none', gelatoOrderId: null, error: null };

  // Nothing for Gelato: no line marks needed
  if (gelato.length === 0) {
    await updateOrder(supabase, order.id, {
      ...splitRoutingFields({ selfCount: selfPrint.length, gelatoCount: 0, gelato: 'none', digitalOk, digitalError: deps.digitalError }),
      ...extra,
    });
    if (selfPrint.length) await auditSplit(supabase, order.id, 'self_print', 'pending', `Split: ${selfPrint.length} item(s) to print here`);
    return result;
  }

  // Mark the lines
  let markError: string | null = null;
  {
    const a = await supabase.from('order_items').update({ fulfillment_provider: 'gelato' } as any).in('id', gelatoIds);
    if (a.error) markError = a.error.message || 'unknown error';
    if (!markError && selfIds.length) {
      const b = await supabase.from('order_items').update({ fulfillment_provider: 'self_print' } as any).in('id', selfIds);
      if (b.error) markError = b.error.message || 'unknown error';
    }
  }
  if (markError) {
    try { await supabase.from('order_items').update({ fulfillment_provider: null } as any).in('id', [...gelatoIds, ...selfIds]); } catch { /* best effort */ }
    const message = `Could not split this order (${markError.slice(0, 200)}). Everything is in your print queue.`;
    await updateOrder(supabase, order.id, {
      fulfillment_provider: 'self_print', self_print_status: 'to_print', fulfillment_status: 'processing',
      error_message: message, ...extra,
    });
    await auditSplit(supabase, order.id, 'self_print', 'pending', 'Could not split: everything queued to print here');
    return { ...result, gelato: 'not_sent', error: message };
  }

  // Decide the Gelato part
  let state: GelatoPartState;
  let error: string | null = null;
  let gelatoOrderId: string | null = null;
  if (!deps.send) {
    state = 'not_sent';
    error = selfPrint.length > 0
      ? 'Not sent to Gelato yet. Use "Send the rest to Gelato" when you are ready.'
      : 'Not sent to Gelato yet. Use "Send to Gelato instead" when you are ready.';
  } else {
    const problems = gelatoProblems(gelato);
    if (problems.length) {
      state = 'not_sent';
      error = `Not sent to Gelato: ${problems.join('; ')}`;
    } else {
      try {
        const sent = await deps.sendGelato!(full, gelato);
        if (sent.success && sent.fulfillmentId) { state = 'sent'; gelatoOrderId = sent.fulfillmentId; }
        else { state = 'failed'; error = `Gelato: ${sent.error || 'order not created'}`; }
      } catch (e: any) {
        state = 'failed';
        error = `Gelato: ${e?.message || 'order not created'}`;
      }
    }
  }
  if (error) error = error.slice(0, 1000);

  await updateOrder(supabase, order.id, {
    ...splitRoutingFields({ selfCount: selfPrint.length, gelatoCount: gelato.length, gelato: state, gelatoOrderId, error, digitalOk, digitalError: deps.digitalError }),
    ...extra,
  });

  if (selfPrint.length) await auditSplit(supabase, order.id, 'self_print', 'pending', `Split: ${selfPrint.length} item(s) to print here`);
  await auditSplit(supabase, order.id, 'gelato', state === 'sent' ? 'processing' : 'failed',
    state === 'sent' ? `Split: ${gelato.length} item(s) sent to Gelato (${gelatoOrderId})` : `Split: Gelato part not sent. ${error ?? ''}`);
  console.log(`[Split routing] Order ${order.order_number}: ${selfPrint.length} to print here, ${gelato.length} for Gelato (${state})`);

  return { ...result, gelato: state, gelatoOrderId, error };
}

// ---------------------------------------------------------------------------------------------
// Gelato webhook helpers (pure). They never touch tracking_code, tracking_url, tracking_number, carrier,
// carrier_name or shipped_at: those belong to our own Royal Mail parcel.

/** Gelato's raw order status mapped to a value the gelato_status CHECK allows. */
export function gelatoStatusForColumn(s: unknown): 'pending' | 'processing' | 'shipped' | 'delivered' | 'error' {
  switch (String(s ?? '').toLowerCase()) {
    case 'created': case 'uploading': case 'passed': case 'pending': case 'draft': return 'pending';
    case 'in_production': case 'printed': case 'processing': return 'processing';
    case 'shipped': case 'in_transit': return 'shipped';
    case 'delivered': return 'delivered';
    case 'failed': case 'canceled': case 'cancelled': case 'on_hold': return 'error';
    default: return 'processing';
  }
}

/**
 * The orders columns to write for a Gelato order status on a non-split order (pure).
 * gelato_status is always written (never moved back from delivered). orders.status is written only when the
 * mapped value is shipped or delivered and the order is in a state it may overwrite, so reports, referral
 * checks and cancelled or refunded orders are not disturbed.
 */
export function gelatoWholeOrderStatusFields(dbOrder: any, rawStatus: unknown): Record<string, any> {
  const incoming = gelatoStatusForColumn(rawStatus);
  const mapped = dbOrder?.gelato_status === 'delivered' && incoming !== 'delivered' ? 'delivered' : incoming;
  const fields: Record<string, any> = { gelato_status: mapped };
  if ((mapped === 'shipped' || mapped === 'delivered') && SPLIT_STATUS_OVERWRITABLE.includes(dbOrder?.status)
      && !(dbOrder?.status === 'delivered' && mapped === 'shipped')) {
    fields.status = mapped;
  }
  return fields;
}

/** Tracking arrived for a non-split order: same rules as gelatoWholeOrderStatusFields for a "shipped" status. */
export function gelatoWholeOrderTrackingStatusFields(dbOrder: any): Record<string, any> {
  return gelatoWholeOrderStatusFields(dbOrder, 'shipped');
}

export function gelatoSplitStatusFields(dbOrder: any, rawStatus: unknown): Record<string, any> {
  const mapped = gelatoStatusForColumn(rawStatus);
  return {
    gelato_status: mapped,
    ...splitStatusFields({ ...dbOrder, gelato_status: mapped }),
    ...(mapped === 'error' ? { error_message: `Gelato reported this order as ${String(rawStatus).slice(0, 40)}` } : {}),
  };
}

export function gelatoSplitTrackingFields(dbOrder: any, orderItem: any, nowIso: string): Record<string, any> {
  const gelato_status = dbOrder?.gelato_status === 'delivered' ? 'delivered' : 'shipped';
  return {
    gelato_tracking_code: String(orderItem?.trackingCode || '').slice(0, 100) || null,
    gelato_tracking_url: safeHttpsUrl(orderItem?.trackingUrl),
    gelato_shipped_at: dbOrder?.gelato_shipped_at || nowIso,
    gelato_status,
    ...splitStatusFields({ ...dbOrder, gelato_status }),
  };
}
