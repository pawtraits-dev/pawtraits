/**
 * POST /api/stall/checkout
 * { imageId, size, email, firstName, lastName, phone?, marketingOptIn? }
 * Creates a PaymentIntent for a ready-made stall print the customer takes home now.
 * Price comes from admin settings (never the browser). Order + account are created by the
 * Stripe webhook exactly like online guest orders, with fulfilment "collected".
 */
import { NextRequest, NextResponse } from 'next/server';
import { createPaymentIntent } from '@/lib/stripe-server';
import { getStallOffer } from '@/lib/stall/offer';
import { serviceClient } from '@/lib/qr/server';
import { VISITOR_COOKIE, validVisitorId } from '@/lib/qr/attribution';
import { CONSENT_COOKIE, parseConsent } from '@/lib/tracking/consent';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  const firstName = String(body.firstName || '').trim().slice(0, 60);
  const lastName = String(body.lastName || '').trim().slice(0, 60);
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
  if (!firstName) return NextResponse.json({ error: 'Please enter your first name' }, { status: 400 });

  const offer = await getStallOffer(request, String(body.imageId || ''), body.size);
  if (!offer.available) {
    return NextResponse.json({ error: 'This print can only be bought on your phone at the stall. Scan the sticker on the back to start.', reason: offer.reason }, { status: 400 });
  }

  const supabase = serviceClient();
  const { data: image } = await supabase.from('image_catalog').select('id, description, stock_ref').eq('id', body.imageId).single();
  const title = `${(image?.description || 'Pawtraits print').slice(0, 60)} — ${offer.size} (stall)`;

  const metadata: Record<string, string> = {
    customerEmail: email,
    customerName: `${firstName} ${lastName}`.trim(),
    orderType: 'customer',
    placedByEmail: email,
    salesChannel: 'stall_online_payment',
    posLocationId: offer.locationId!,
    qrScanId: offer.scanId!,
    stallSize: offer.size!,
    stockRef: String(image?.stock_ref ?? ''),
    cartItemCount: '1',
    item1_id: body.imageId,
    item1_product_id: `stall_print_${offer.size}`,
    item1_title: title.slice(0, 50),
    item1_qty: '1',
    item1_unit_price: String(offer.pricePence),
    priceCheck: 'ok',
    ...(body.phone ? { customerPhone: String(body.phone).slice(0, 30) } : {}),
    ...(body.marketingOptIn ? { marketingOptIn: 'true' } : {}),
  };

  const pi = await createPaymentIntent({ amount: offer.pricePence!, currency: 'gbp', customerEmail: email, metadata, automaticPaymentMethods: true });

  const consent = parseConsent(request.cookies.get(CONSENT_COOKIE)?.value);
  await supabase.from('pending_checkouts').upsert({
    payment_intent_id: pi.id,
    customer_email: email,
    cart: [{ productId: `stall_print_${offer.size}`, imageId: body.imageId, imageTitle: title, quantity: 1, unitPrice: offer.pricePence, originalPrice: offer.listPricePence }],
    fulfillment: 'collect',
    guest_session_id: validVisitorId(request.cookies.get(VISITOR_COOKIE)?.value),
    consent,
    client: consent?.marketing ? {
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      ua: request.headers.get('user-agent'),
      fbp: request.cookies.get('_fbp')?.value ?? null,
      fbc: request.cookies.get('_fbc')?.value ?? null,
      url: request.headers.get('referer'),
    } : null,
  }, { onConflict: 'payment_intent_id' });

  return NextResponse.json({ clientSecret: pi.client_secret, paymentIntentId: pi.id, amount: pi.amount });
}
