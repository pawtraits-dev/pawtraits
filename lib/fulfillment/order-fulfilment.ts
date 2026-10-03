/**
 * Admin fulfilment operations (server only).
 *
 * Self-print (default):  to_print → printed → packed → posted
 * Gelato (optional):     "Send to Gelato" creates the Gelato order; the Gelato webhook
 *                        then records shipping and tracking.
 *
 * Every change is also written to order_fulfillment_tracking as an audit trail.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { GelatoFulfillmentService } from './gelato-fulfillment-service';
import { countryName, deliveryFor, deliveryWindow, heroImage } from '@/lib/messaging/order-email';
import { postedItems, needsPosting, fulfilmentStage, POSTAGE_SERVICES, SELF_PRINT_STEPS, STAGE_LABELS, royalMailTrackingUrl } from './shared';
import type { FulfilmentStage, SelfPrintStatus, PostageServiceId } from '@/lib/product-types';

export { postedItems, needsPosting, fulfilmentStage, POSTAGE_SERVICES };
import { sendMessage } from '@/lib/messaging/message-service';
import { resolveOrderImage, buildPrintFiles } from '@/lib/orders/order-image';

export type FulfilmentAction =
  | { action: 'mark_printed' | 'mark_packed' | 'undo' | 'use_self_print' | 'send_to_gelato' | 'release' }
  | { action: 'mark_posted'; service: PostageServiceId; carrier?: string; trackingCode?: string; trackingUrl?: string; notify?: boolean }
  | { action: 'resend_posted_email' | 'rebuild_print_files' }
  | { action: 'save_notes'; notes: string };

export class FulfilmentError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const ORDER_SELECT = '*, order_items (*)';

async function loadOrder(supabase: SupabaseClient, orderId: string) {
  const { data, error } = await supabase.from('orders').select(ORDER_SELECT).eq('id', orderId).maybeSingle();
  if (error) throw new FulfilmentError(error.message, 500);
  if (!data) throw new FulfilmentError('Order not found', 404);
  return data as any;
}

async function audit(supabase: SupabaseClient, orderId: string, method: string, status: string, message: string, data?: any) {
  try {
    await supabase.from('order_fulfillment_tracking').insert({
      order_id: orderId,
      fulfillment_method: method,
      status,
      status_message: message.slice(0, 500),
      tracking_data: data ?? null,
      ...(status === 'fulfilled' ? { completed_at: new Date().toISOString() } : {}),
      ...(status === 'failed' ? { failed_at: new Date().toISOString() } : {}),
    });
  } catch (e) {
    console.warn('Fulfilment audit write failed (non-critical)', e);
  }
}

const auditStatus: Record<SelfPrintStatus, string> = { to_print: 'pending', printed: 'processing', packed: 'processing', posted: 'fulfilled' };

/**
 * Apply one admin action to an order and return the updated order.
 */
export async function applyFulfilmentAction(supabase: SupabaseClient, orderId: string, input: FulfilmentAction) {
  const order = await loadOrder(supabase, orderId);
  const now = new Date().toISOString();
  const stage = fulfilmentStage(order);

  if (input.action === 'save_notes') {
    await update(supabase, orderId, { fulfillment_notes: String(input.notes || '').slice(0, 2000) });
    return loadOrder(supabase, orderId);
  }

  if (!stage) throw new FulfilmentError('This order has nothing to post (downloads or prints collected at the stall).');

  switch (input.action) {
    case 'release':
    case 'use_self_print': {
      if (order.gelato_order_id) {
        throw new FulfilmentError('This order has already been sent to Gelato. Cancel it in the Gelato dashboard first, then contact support to reset it.', 409);
      }
      if (stage !== 'on_hold' && stage !== 'needs_routing' && input.action === 'release') {
        throw new FulfilmentError('Order is not on hold.');
      }
      if (stage === 'posted') throw new FulfilmentError('Order has already been posted.');
      await update(supabase, orderId, {
        fulfillment_provider: 'self_print',
        self_print_status: order.self_print_status && order.fulfillment_provider === 'self_print' ? order.self_print_status : 'to_print',
        fulfillment_status: 'processing',
        ...(order.status === 'on_hold' ? { status: 'confirmed', error_message: null } : {}),
      });
      await audit(supabase, orderId, 'self_print', 'pending', order.status === 'on_hold' ? 'Released from hold to self-print' : 'Queued to self-print');
      break;
    }

    case 'mark_printed':
    case 'mark_packed': {
      const from: SelfPrintStatus = input.action === 'mark_printed' ? 'to_print' : 'printed';
      const to: SelfPrintStatus = input.action === 'mark_printed' ? 'printed' : 'packed';
      if (stage !== from) throw new FulfilmentError(`Order is "${label(stage)}", not "${label(from)}".`, 409);
      await update(supabase, orderId, {
        self_print_status: to,
        [to === 'printed' ? 'printed_at' : 'packed_at']: now,
      });
      await audit(supabase, orderId, 'self_print', auditStatus[to], `Marked ${label(to)}`);
      break;
    }

    case 'mark_posted': {
      if (!['to_print', 'printed', 'packed'].includes(stage as string)) {
        throw new FulfilmentError(stage === 'posted' ? 'Order has already been posted.' : `Order is "${label(stage)}" — it can't be marked posted here.`, 409);
      }
      const service = POSTAGE_SERVICES.find(s => s.id === input.service);
      if (!service) throw new FulfilmentError('Choose a postage service.');
      const trackingCode = (input.trackingCode || '').trim().toUpperCase().replace(/\s+/g, '');
      if (service.tracked && service.id !== 'other' && !trackingCode) {
        throw new FulfilmentError(`${service.label} is tracked — enter the tracking number.`);
      }
      if (trackingCode && !/^[A-Z0-9-]{6,40}$/.test(trackingCode)) throw new FulfilmentError('That tracking number doesn\'t look right.');
      const carrierLabel = service.id === 'other' ? (input.carrier || '').trim() || 'Courier' : service.label;
      const trackingUrl = (input.trackingUrl || '').trim()
        || (trackingCode && service.carrier === 'Royal Mail' ? royalMailTrackingUrl(trackingCode) : '');
      if (trackingUrl && !/^https:\/\//.test(trackingUrl)) throw new FulfilmentError('Tracking link must start with https://');

      await update(supabase, orderId, {
        self_print_status: 'posted',
        ...(order.printed_at ? {} : { printed_at: now }),
        ...(order.packed_at ? {} : { packed_at: now }),
        shipped_at: now,
        carrier: carrierLabel,
        tracking_code: trackingCode || null,
        tracking_number: trackingCode || null,
        tracking_url: trackingUrl || null,
        status: 'shipped',
        fulfillment_status: 'fulfilled',
      });
      await audit(supabase, orderId, 'self_print', 'fulfilled', `Posted via ${carrierLabel}${trackingCode ? ` (${trackingCode})` : ''}`, { carrier: carrierLabel, trackingCode, trackingUrl });
      if (input.notify !== false) {
        await sendPostedEmail(supabase, orderId, service.eta);
      }
      break;
    }

    case 'rebuild_print_files': {
      if (order.gelato_order_id) throw new FulfilmentError('Already at Gelato — its files were sent with the order.', 409);
      let rebuilt = 0;
      for (const item of postedItems(order)) {
        const img = await resolveOrderImage(supabase, item.image_id);
        if (!img) continue;
        const productData = typeof item.product_data === 'string' ? JSON.parse(item.product_data) : item.product_data;
        const files = await buildPrintFiles(img, productData, order.id);
        const { error } = await supabase.from('order_items').update({
          print_image_url: files.printUrl,
          self_print_file_url: files.selfPrintUrl,
          print_file_meta: files.meta,
        }).eq('id', item.id);
        if (error) {
          throw new FulfilmentError(/self_print_file_url|print_file_meta/.test(error.message)
            ? 'Run db/migrations/2026-09-30-print-crops.sql first.' : error.message, 500);
        }
        rebuilt++;
      }
      // Large custom portraits: make (or retry) the 4K master, which rebuilds these lines again from it
      const { finishPrintFiles } = await import('@/lib/print/print-master');
      const { data: fresh } = await supabase.from('order_items').select('*').eq('order_id', orderId);
      await finishPrintFiles(supabase, (fresh || []).map((i: any) =>
        i.print_file_meta?.print_master === 'failed' ? { ...i, print_file_meta: { ...i.print_file_meta, print_master: 'pending' } } : i));
      await audit(supabase, orderId, order.fulfillment_provider || 'self_print', auditStatus[(order.self_print_status as SelfPrintStatus) || 'to_print'] || 'pending', `Rebuilt ${rebuilt} print file(s)`);
      break;
    }

    case 'resend_posted_email': {
      if (stage !== 'posted') throw new FulfilmentError('Only posted orders can be emailed.');
      await sendPostedEmail(supabase, orderId);
      break;
    }

    case 'undo': {
      if (order.fulfillment_provider !== 'self_print' || !order.self_print_status) throw new FulfilmentError('Nothing to undo.');
      const idx = SELF_PRINT_STEPS.indexOf(order.self_print_status);
      if (idx <= 0) throw new FulfilmentError('Already at the first step.');
      const back = SELF_PRINT_STEPS[idx - 1];
      await update(supabase, orderId, {
        self_print_status: back,
        ...(order.self_print_status === 'posted' ? { shipped_at: null, status: 'confirmed', fulfillment_status: 'processing' } : {}),
        ...(order.self_print_status === 'packed' ? { packed_at: null } : {}),
        ...(order.self_print_status === 'printed' ? { printed_at: null } : {}),
      });
      await audit(supabase, orderId, 'self_print', auditStatus[back], `Moved back to ${label(back)}`);
      break;
    }

    case 'send_to_gelato': {
      if (order.gelato_order_id) throw new FulfilmentError('Already sent to Gelato.', 409);
      if (stage === 'posted') throw new FulfilmentError('Order has already been posted.', 409);
      const items = postedItems(order);
      const gelato = new GelatoFulfillmentService();
      const result = await gelato.fulfill(order, items);
      if (!result.success || !result.fulfillmentId) {
        await update(supabase, orderId, { error_message: `Gelato: ${result.error || 'order not created'}`.slice(0, 1000) });
        await audit(supabase, orderId, 'gelato', 'failed', result.error || 'Gelato order not created');
        throw new FulfilmentError(`Gelato didn't accept the order: ${result.error || 'unknown error'}`, 502);
      }
      await update(supabase, orderId, {
        fulfillment_provider: 'gelato',
        self_print_status: null,
        gelato_order_id: result.fulfillmentId,
        gelato_status: 'pending',
        fulfillment_status: 'fulfilled',
        error_message: null,
        ...(order.status === 'on_hold' ? { status: 'confirmed' } : {}),
      });
      await audit(supabase, orderId, 'gelato', 'processing', `Sent to Gelato (${result.fulfillmentId})`, { gelatoOrderId: result.fulfillmentId });
      break;
    }

    default:
      throw new FulfilmentError('Unknown action');
  }

  return loadOrder(supabase, orderId);
}

async function update(supabase: SupabaseClient, orderId: string, fields: Record<string, any>) {
  const { error } = await supabase.from('orders').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', orderId);
  if (error) {
    if (/fulfillment_provider|self_print_status|printed_at|packed_at|carrier|tracking_code|fulfillment_notes/.test(error.message)) {
      throw new FulfilmentError('The self-print database migration hasn\'t been run yet (db/migrations/2026-09-29-self-print-fulfilment.sql).', 500);
    }
    throw new FulfilmentError(error.message, 500);
  }
}

function label(stage: string | null): string {
  return (STAGE_LABELS as Record<string, string>)[stage || ''] || String(stage);
}

/** "Your order is on its way" email. Records shipped_email_sent_at. */
export async function sendPostedEmail(supabase: SupabaseClient, orderId: string, eta?: string) {
  const order = await loadOrder(supabase, orderId);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://pawtraits.pics';
  const service = POSTAGE_SERVICES.find(s => s.label === order.carrier);
  const { data: profile } = await supabase.from('user_profiles').select('id').eq('email', order.customer_email).maybeSingle();
  const itemCount = postedItems(order).reduce((n: number, i: any) => n + (i.quantity || 1), 0);
  const trackingCode = order.tracking_code || order.tracking_number || '';

  const result = await sendMessage({
    templateKey: 'order_shipped',
    recipientType: 'customer',
    recipientId: profile?.id || null,
    recipientEmail: order.customer_email,
    variables: {
      base_url: baseUrl,
      customer_name: order.shipping_first_name || 'there',
      order_number: order.order_number,
      shipped_date: new Date(order.shipped_at || Date.now()).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }),
      tracking_number: trackingCode,
      tracking_url: order.tracking_url || '',
      has_tracking: !!trackingCode,
      carrier_name: service?.carrier || order.carrier || 'Royal Mail',
      shipping_method: service ? service.label.replace(/^Royal Mail /, '') : '',
      estimated_delivery_date: deliveryWindow(new Date(order.shipped_at || Date.now()), eta || service?.eta || deliveryFor(order.shipping_country).days)
        ?? `Usually ${eta || service?.eta || '2–3 working days'}`,
      hero_image_url: heroImage(order.order_items ?? []).url,
      shipping_country_name: countryName(order.shipping_country),
      item_count: itemCount,
      shipping_city: order.shipping_city,
      shipping_postcode: order.shipping_postcode,
      shipping_country: order.shipping_country,
      order_url: `${baseUrl}/orders/${order.id}`,
      is_self_print: order.fulfillment_provider !== 'gelato',
    },
    priority: 'high',
  } as any);

  if (!result.success) {
    console.error('Posted email failed', result.errors);
    throw new FulfilmentError(`Order updated, but the email failed: ${result.errors?.join('; ') || 'unknown error'}`, 502);
  }
  await supabase.from('orders').update({ shipped_email_sent_at: new Date().toISOString() }).eq('id', orderId);
}

/**
 * Queue: orders that need posting, newest last within each stage (oldest first = print first).
 */
export async function getFulfilmentQueue(supabase: SupabaseClient, opts: { postedDays?: number } = {}) {
  const since = new Date(Date.now() - (opts.postedDays ?? 14) * 86400_000).toISOString();
  // Open work + recently posted/Gelato orders. Paid orders only.
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('payment_status', 'paid')
    .or(`self_print_status.is.null,self_print_status.neq.posted,shipped_at.gte.${since}`)
    .gte('created_at', new Date(Date.now() - 180 * 86400_000).toISOString())
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) throw new FulfilmentError(error.message, 500);

  const orders = (data || [])
    .map((o: any) => ({ ...o, fulfilment_stage: fulfilmentStage(o) }))
    .filter((o: any) => o.fulfilment_stage)
    // Gelato orders only while in the last 30 days (they look after themselves)
    .filter((o: any) => o.fulfilment_stage !== 'gelato' || new Date(o.created_at).getTime() > Date.now() - 30 * 86400_000);

  const counts: Record<string, number> = {};
  for (const o of orders) counts[o.fulfilment_stage] = (counts[o.fulfilment_stage] || 0) + 1;
  return { orders, counts };
}
