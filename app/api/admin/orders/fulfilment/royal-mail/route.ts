/**
 * Royal Mail labels for packed orders (lib/shipping/royal-mail/server.ts).
 * GET  ?ids=<orderId>,…   the suggested parcel for each (format, weight, service), the settings and
 *                         whether Click & Drop / tracking are connected
 * POST { orders: [{ orderId, format?, grams?, serviceCode? }], markPosted?: boolean }
 *      → { results, pdf: base64 | null }  (one PDF of labels; customs forms included for overseas)
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { getSetting } from '@/lib/app-settings';
import { clickAndDropConfigured } from '@/lib/shipping/royal-mail/click-and-drop';
import { trackingConfigured } from '@/lib/shipping/royal-mail/tracking-api';
import { makeLabels, planShipment } from '@/lib/shipping/royal-mail/server';
import { needsPosting } from '@/lib/fulfillment/order-fulfilment';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;
const UUID = /^[0-9a-f-]{36}$/i;
const FORMATS = ['largeLetter', 'smallParcel', 'mediumParcel', 'largeParcel', 'parcel'];

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const ids = (request.nextUrl.searchParams.get('ids') || '').split(',').filter(id => UUID.test(id)).slice(0, 100);
  const settings = await getSetting('royal_mail');
  const { data, error } = ids.length ? await serviceClient().from('orders').select('*, order_items (*)').in('id', ids) : { data: [] as any[], error: null };
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    connected: { clickAndDrop: clickAndDropConfigured(), tracking: trackingConfigured() },
    settings,
    plans: ids.map(id => (data ?? []).find((o: any) => o.id === id)).filter((o: any) => o && needsPosting(o)).map((o: any) => ({
      ...planShipment(o, settings),
      name: `${o.shipping_first_name || ''} ${o.shipping_last_name || ''}`.trim(),
      postcode: (o.shipping_postcode || '').toUpperCase(), country: o.shipping_country,
      labelled: !!o.rm_order_identifier, trackingNumber: o.tracking_number || null,
    })),
  });
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  const orders = (Array.isArray(body.orders) ? body.orders : []).filter((o: any) => UUID.test(String(o?.orderId || ''))).slice(0, 100).map((o: any) => ({
    orderId: o.orderId,
    format: FORMATS.includes(o.format) ? o.format : undefined,
    grams: Number(o.grams) > 0 && Number(o.grams) <= 30000 ? Number(o.grams) : undefined,
    serviceCode: typeof o.serviceCode === 'string' && /^[A-Z0-9]{0,10}$/i.test(o.serviceCode) ? o.serviceCode.toUpperCase() : undefined,
  }));
  if (!orders.length) return NextResponse.json({ error: 'Choose at least one order' }, { status: 400 });
  try {
    const { pdf, results } = await makeLabels(serviceClient(), orders, { markPosted: body.markPosted === true });
    return NextResponse.json({ results, pdf: pdf ? Buffer.from(pdf).toString('base64') : null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not make the labels' }, { status: e?.status && e.status < 600 ? e.status : 500 });
  }
}
