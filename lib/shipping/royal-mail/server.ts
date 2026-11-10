/**
 * Royal Mail labels and tracking for posted orders (server only).
 *
 *   planShipment()     the parcel for an order: large letter / small / medium parcel, weight, service
 *   makeLabels()       send packed orders to Click & Drop, save the tracking numbers, return one
 *                      label PDF (and optionally mark them posted, which emails the customer)
 *   refreshTracking()  read Royal Mail tracking for one order; save the timeline; tell the customer
 *                      (email + account inbox) when it's out for delivery, delivered, missed, waiting
 *                      to be collected or coming back; mark it posted at the first scan if needed
 *   trackingSweep()    the cron: every posted parcel that isn't delivered, at a sensible interval
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSetting, type RoyalMailSettings } from '@/lib/app-settings';
import { postedItems, royalMailTrackingUrl, itemTitle } from '@/lib/fulfillment/shared';
import { countryCode } from '@/lib/fulfillment/packing-slips';
import { shippingZoneFor } from '@/lib/shipping/rates';
import { heroImage } from '@/lib/messaging/order-email';
import { sendMessage } from '@/lib/messaging/message-service';
import { createOrders, getLabels, getOrders, type CDCreateOrder, type CDPackage } from './click-and-drop';
import { fetchTracking } from './tracking-api';
import { FINAL_STAGES, STAGE_TEXT, type TrackingStage } from './status';

export const RM_MIGRATION = 'Run db/migrations/2026-11-09-royal-mail.sql first';
type Format = CDPackage['packageFormatIdentifier'];

// Royal Mail size limits (cm), less ~1 cm for the board-backed envelope or box
const LARGE_LETTER = { long: 34, short: 24 };   // 35.3 × 25 × 2.5 cm, up to 750 g
const SMALL_PARCEL = { long: 44, short: 34 };   // 45 × 35 × 16 cm, up to 2 kg

function parse(v: any) { if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch { return {}; } }
const dims = (item: any) => {
  const p = parse(item.product_data) || {};
  const w = Number(p.width_cm) || 20, h = Number(p.height_cm) || 30;
  return { long: Math.max(w, h), short: Math.min(w, h), area: w * h };
};

export interface ShipmentPlan { orderId: string; orderNumber: string; format: Format; grams: number; serviceCode: string; destination: 'uk' | 'europe' | 'world'; prints: number; note: string | null }

/** The parcel for an order (the admin can change it before making the label) */
export function planShipment(order: any, s: RoyalMailSettings): ShipmentPlan {
  const items = postedItems(order);
  const prints = items.reduce((n: number, i: any) => n + (i.quantity || 1), 0);
  const ds = items.map(dims);
  const long = Math.max(0, ...ds.map(d => d.long)), short = Math.max(0, ...ds.map(d => d.short));
  const printGrams = items.reduce((g: number, i: any) => g + dims(i).area / 100 * s.print_grams_per_100cm2 * (i.quantity || 1), 0);
  const grams = Math.max(50, Math.round(s.packaging_grams + printGrams));
  let format: Format = 'mediumParcel';
  if (long <= LARGE_LETTER.long && short <= LARGE_LETTER.short && prints <= s.large_letter_max_prints && grams <= 750) format = 'largeLetter';
  else if (long <= SMALL_PARCEL.long && short <= SMALL_PARCEL.short && grams <= 2000) format = 'smallParcel';
  const zone = shippingZoneFor(countryCode(order.shipping_country));
  const destination = zone === 'GB' ? 'uk' : zone === 'EUROPE' ? 'europe' : 'world';
  return {
    orderId: order.id, orderNumber: order.order_number, format, grams,
    serviceCode: destination === 'uk' ? s.service_uk : destination === 'europe' ? s.service_europe : s.service_world,
    destination, prints,
    note: format === 'mediumParcel' ? 'Too big for a small parcel' : null,
  };
}

function cdOrder(order: any, plan: { format: Format; grams: number; serviceCode: string }): CDCreateOrder {
  const items = postedItems(order);
  const country = countryCode(order.shipping_country) || 'GB';
  const overseas = country !== 'GB';
  const per = Math.max(1, Math.round(plan.grams / Math.max(1, items.reduce((n: number, i: any) => n + (i.quantity || 1), 0))));
  return {
    orderReference: String(order.order_number).slice(0, 40),
    recipient: {
      address: {
        fullName: `${order.shipping_first_name || ''} ${order.shipping_last_name || ''}`.trim().slice(0, 210) || undefined,
        companyName: order.order_type === 'partner_for_client' ? (order.client_name || undefined) : undefined,
        addressLine1: (order.shipping_address_line_1 || order.shipping_address || '').slice(0, 100),
        addressLine2: (order.shipping_address_line_2 || '').slice(0, 100) || undefined,
        city: (order.shipping_city || '').slice(0, 100),
        postcode: (order.shipping_postcode || '').toUpperCase().slice(0, 20) || undefined,
        countryCode: country,
      },
      phoneNumber: order.metadata?.customerPhone || undefined,
    },
    orderDate: new Date(order.created_at).toISOString(),
    subtotal: ((order.total_amount || 0) - (order.shipping_amount || 0)) / 100,
    shippingCostCharged: (order.shipping_amount || 0) / 100,
    total: (order.total_amount || 0) / 100,
    currencyCode: (order.currency || 'GBP').toUpperCase(),
    packages: [{
      weightInGrams: plan.grams,
      packageFormatIdentifier: plan.format,
      // Customs (CN22/CN23) for overseas parcels
      ...(overseas ? {
        contents: items.map((i: any) => ({
          name: `Pet portrait print: ${itemTitle(i)}`.slice(0, 80), SKU: String(i.product_id || 'PRINT').slice(0, 100),
          quantity: i.quantity || 1, unitValue: Math.round(i.unit_price || 0) / 100, unitWeightInGrams: per,
          customsDescription: 'Printed picture on foam board', customsCode: '49119100',
        })),
      } : {}),
    }],
    postageDetails: plan.serviceCode ? { serviceCode: plan.serviceCode } : undefined,
    label: { includeLabelInResponse: false, includeCN: overseas, includeReturnsLabel: false },
  };
}

/** Which "Mark posted" service a Click & Drop service code is (for the customer's delivery estimate) */
const postedServiceFor = (code: string) => (/24|TPN|TRN|CRL1/i.test(code) ? 'rm_tracked_24' : 'rm_tracked_48');

export interface LabelResult { orderId: string; orderNumber: string; ok: boolean; trackingNumber?: string; error?: string; posted?: boolean }

/**
 * Labels for packed orders. Orders already sent to Click & Drop just get their label again.
 * markPosted: also mark each one posted (the customer gets the "on its way" email).
 */
export async function makeLabels(supabase: SupabaseClient, requests: { orderId: string; format?: Format; grams?: number; serviceCode?: string }[], opts: { markPosted?: boolean } = {}): Promise<{ pdf: Uint8Array | null; results: LabelResult[] }> {
  const s = await getSetting('royal_mail');
  const { data: orders, error } = await supabase.from('orders').select('*, order_items (*)').in('id', requests.map(r => r.orderId));
  if (error) throw new Error(error.message);
  const results: LabelResult[] = [];
  const fresh: { order: any; body: CDCreateOrder; plan: any }[] = [];
  const identifiers = new Map<string, number>();   // order id → Click & Drop id

  for (const r of requests) {
    const order = (orders ?? []).find((o: any) => o.id === r.orderId);
    if (!order) { results.push({ orderId: r.orderId, orderNumber: '?', ok: false, error: 'Order not found' }); continue; }
    if (!postedItems(order).length) { results.push({ orderId: order.id, orderNumber: order.order_number, ok: false, error: 'Nothing to post' }); continue; }
    if (order.rm_order_identifier) { identifiers.set(order.id, Number(order.rm_order_identifier)); continue; }
    if (!(order.shipping_address_line_1 || order.shipping_address) || !order.shipping_city) { results.push({ orderId: order.id, orderNumber: order.order_number, ok: false, error: 'No delivery address' }); continue; }
    const plan = { ...planShipment(order, s), ...(r.format ? { format: r.format } : {}), ...(r.grams ? { grams: Math.round(r.grams) } : {}), ...(r.serviceCode !== undefined ? { serviceCode: r.serviceCode } : {}) };
    fresh.push({ order, body: cdOrder(order, plan), plan });
  }

  // Send the new ones (100 a call)
  for (let i = 0; i < fresh.length; i += 100) {
    const batch = fresh.slice(i, i + 100);
    const { created, failed } = await createOrders(batch.map(b => b.body));
    for (const b of batch) {
      const c = created.find(x => x.orderReference === b.body.orderReference);
      if (!c) {
        const f = failed.find(x => x.orderReference === b.body.orderReference);
        results.push({ orderId: b.order.id, orderNumber: b.order.order_number, ok: false, error: f?.errors.join('; ') || 'Click & Drop didn\'t create it' });
        continue;
      }
      identifiers.set(b.order.id, c.orderIdentifier);
      const { error: e } = await supabase.from('orders').update({
        rm_order_identifier: c.orderIdentifier, rm_label_created_at: new Date().toISOString(),
        rm_package: { format: b.plan.format, grams: b.plan.grams, serviceCode: b.plan.serviceCode || null },
        tracking_status: 'label_created', updated_at: new Date().toISOString(),
      }).eq('id', b.order.id);
      if (e) throw new Error(/rm_|tracking_status/.test(e.message) ? RM_MIGRATION : e.message);
    }
  }

  if (!identifiers.size) return { pdf: null, results };
  const pdf = await getLabels(Array.from(identifiers.values()));

  // Tracking numbers exist once the label is made
  const ids = Array.from(identifiers.entries());
  const known = await getOrders(ids.map(([, n]) => n)).catch(() => []);
  for (const [orderId, n] of ids) {
    const order = (orders ?? []).find((o: any) => o.id === orderId)!;
    const tracking = known.find(k => k.orderIdentifier === n)?.trackingNumber || order.tracking_number || null;
    const plan = fresh.find(f => f.order.id === orderId)?.plan ?? order.rm_package ?? {};
    const res: LabelResult = { orderId, orderNumber: order.order_number, ok: true, trackingNumber: tracking ?? undefined };
    if (tracking && tracking !== order.tracking_number) {
      await supabase.from('orders').update({ tracking_number: tracking, tracking_code: tracking, tracking_url: royalMailTrackingUrl(tracking), updated_at: new Date().toISOString() }).eq('id', orderId);
    }
    if (opts.markPosted && order.self_print_status !== 'posted') {
      try {
        const { applyFulfilmentAction } = await import('@/lib/fulfillment/order-fulfilment');
        await applyFulfilmentAction(supabase, orderId, { action: 'mark_posted', service: postedServiceFor(plan.serviceCode || '') as any, trackingCode: tracking || undefined, notify: true });
        res.posted = true;
      } catch (e: any) { res.error = `Label made, not marked posted: ${e?.message || e}`; }
    }
    results.push(res);
  }
  return { pdf, results };
}

// ---------------------------------------------------------------------------------------------
// Tracking

const MILESTONES: Partial<Record<TrackingStage, { subject: string; headline: string; message: string }>> = {
  out_for_delivery: { subject: 'Your Pawtrait is out for delivery today 🚚', headline: 'Out for delivery today', message: 'Royal Mail has your Pawtrait on today’s round. Keep an eye out for the postie!' },
  attempted: { subject: 'Royal Mail tried to deliver your Pawtrait', headline: 'We missed you', message: 'Royal Mail tried to deliver your Pawtrait but couldn’t. They’ll have left a card telling you how to rebook or collect it.' },
  awaiting_collection: { subject: 'Your Pawtrait is waiting for you to collect', headline: 'Ready to collect', message: 'Your Pawtrait is waiting at your local Royal Mail office or Post Office. Take the card they left (and some ID) to collect it.' },
  delivered: { subject: 'Your Pawtrait has been delivered 🐾', headline: 'Delivered!', message: 'Your Pawtrait has arrived. We hope it makes you smile every time you walk past it.' },
  returned: { subject: 'Your Pawtrait is coming back to us', headline: 'It’s on its way back to us', message: 'Royal Mail couldn’t deliver your Pawtrait and is returning it to us. We’ll be in touch to sort out getting it to you.' },
  exception: { subject: 'An update on your Pawtrait delivery', headline: 'There’s a hold-up', message: 'Royal Mail has flagged a problem with the delivery. We’re keeping an eye on it and will be in touch if we need anything.' },
};

async function notifyStage(supabase: SupabaseClient, order: any, stage: TrackingStage, ev: { at: string; location: string | null } | null) {
  const m = MILESTONES[stage];
  if (!m) return;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://pawtraits.pics';
  const { data: profile } = await supabase.from('user_profiles').select('id').eq('email', order.customer_email).maybeSingle();
  const when = ev?.at ? new Date(ev.at).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }) : '';
  const result = await sendMessage({
    templateKey: 'order_tracking_update',
    recipientType: 'customer',
    recipientId: profile?.id || null,
    recipientEmail: order.customer_email,
    variables: {
      base_url: baseUrl,
      customer_name: order.shipping_first_name || 'there',
      order_number: order.order_number,
      stage,
      subject: m.subject, headline: m.headline, message: m.message,
      inbox_title: `${m.headline} · ${order.order_number}`, inbox_body: m.message,
      event_time: when, event_location: ev?.location || '',
      tracking_number: order.tracking_number || '',
      tracking_url: order.tracking_url || (order.tracking_number ? royalMailTrackingUrl(order.tracking_number) : ''),
      order_url: `${baseUrl}/orders/${order.id}`,
      hero_image_url: heroImage(order.order_items ?? []).url,
    },
    priority: 'high',
  } as any);
  if (!result.success) throw new Error(result.errors?.join('; ') || 'notification failed');
}

/** How long until a parcel is checked again */
function nextCheckMinutes(stage: TrackingStage | null): number {
  switch (stage) {
    case 'out_for_delivery': return 45;
    case 'attempted': case 'awaiting_collection': case 'exception': return 180;
    case 'label_created': return 120;
    default: return 150;
  }
}

/** Read Royal Mail tracking for one order and act on it */
export async function refreshTracking(supabase: SupabaseClient, orderId: string): Promise<{ stage: TrackingStage; changed: boolean; notified: TrackingStage | null }> {
  const { data: order, error } = await supabase.from('orders').select('*, order_items (*)').eq('id', orderId).maybeSingle();
  if (error) throw new Error(/tracking_|rm_/.test(error.message) ? RM_MIGRATION : error.message);
  if (!order?.tracking_number) throw new Error('No tracking number');
  const now = new Date().toISOString();
  let t;
  try {
    t = await fetchTracking(order.tracking_number);
  } catch (e: any) {
    await supabase.from('orders').update({ tracking_checked_at: now, tracking_error: String(e?.message || e).slice(0, 300) }).eq('id', orderId);
    throw e;
  }
  const before = order.tracking_status as TrackingStage | null;
  const stage = t.notFoundYet && before && before !== 'label_created' ? before : t.stage;
  const changed = stage !== before || (t.events.length && t.events[0].at !== order.tracking_last_event_at);
  const fields: Record<string, unknown> = {
    tracking_status: stage, tracking_status_text: t.statusText, tracking_checked_at: now, tracking_error: null,
    ...(t.events.length ? { tracking_events: t.events.slice(0, 40), tracking_last_event_at: t.lastEventAt } : {}),
    ...(stage === 'delivered' && !order.delivered_at ? { delivered_at: t.deliveredAt || now } : {}),
  };
  const { error: e2 } = await supabase.from('orders').update(fields).eq('id', orderId);
  if (e2) throw new Error(e2.message);
  if (stage === 'delivered' && order.status !== 'delivered') {
    // Not every database allows 'delivered' as an order status: ignore if it doesn't
    await supabase.from('orders').update({ status: 'delivered', fulfillment_status: 'delivered' }).eq('id', orderId).then(() => null, () => null);
  }

  // First scan and it was never marked posted (label made, posted later): mark it now
  if (stage !== 'label_created' && order.self_print_status && order.self_print_status !== 'posted') {
    try {
      const { applyFulfilmentAction } = await import('@/lib/fulfillment/order-fulfilment');
      await applyFulfilmentAction(supabase, orderId, { action: 'mark_posted', service: postedServiceFor(order.rm_package?.serviceCode || '') as any, trackingCode: order.tracking_number, notify: true });
    } catch (e) { console.warn('auto mark posted failed', order.order_number, e); }
  }

  // Tell the customer once per milestone
  let notified: TrackingStage | null = null;
  const sent = (order.tracking_notified ?? {}) as Record<string, string>;
  if (stage !== before && MILESTONES[stage] && !sent[stage]) {
    try {
      await notifyStage(supabase, order, stage, t.events[0] ?? null);
      notified = stage;
      await supabase.from('orders').update({ tracking_notified: { ...sent, [stage]: now } }).eq('id', orderId);
    } catch (e) { console.error('tracking notification failed', order.order_number, e); }
  }
  return { stage, changed: !!changed, notified };
}

/** Cron: posted parcels that aren't delivered (last 45 days), each when it's due */
export async function trackingSweep(supabase: SupabaseClient, budgetMs = 200_000): Promise<{ checked: number; notified: number; errors: string[] }> {
  const started = Date.now();
  const since = new Date(Date.now() - 45 * 86400_000).toISOString();
  const { data, error } = await supabase.from('orders')
    .select('id, order_number, tracking_status, tracking_checked_at, carrier')
    .not('tracking_number', 'is', null).is('delivered_at', null)
    .or(`shipped_at.gte.${since},rm_label_created_at.gte.${since}`)
    .order('tracking_checked_at', { ascending: true, nullsFirst: true }).limit(200);
  if (error) throw new Error(/tracking_|rm_|delivered_at/.test(error.message) ? RM_MIGRATION : error.message);
  let checked = 0, notified = 0;
  const errors: string[] = [];
  for (const o of data ?? []) {
    if (Date.now() - started > budgetMs) break;
    if (FINAL_STAGES.includes(o.tracking_status as TrackingStage)) continue;
    if (o.carrier && !/royal mail/i.test(o.carrier)) continue;
    const due = !o.tracking_checked_at || Date.now() - new Date(o.tracking_checked_at).getTime() >= nextCheckMinutes(o.tracking_status as TrackingStage) * 60_000;
    if (!due) continue;
    try {
      const r = await refreshTracking(supabase, o.id);
      checked++; if (r.notified) notified++;
    } catch (e: any) { errors.push(`${o.order_number}: ${String(e?.message || e).slice(0, 120)}`); }
    await new Promise(r => setTimeout(r, 250));
  }
  return { checked, notified, errors: errors.slice(0, 10) };
}

export { STAGE_TEXT };
