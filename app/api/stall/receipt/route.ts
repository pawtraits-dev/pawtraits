/**
 * GET /api/stall/receipt?pi=pi_...
 * Proof-of-payment screen data for stall sales. Checks Stripe directly (shows PAID the
 * moment the payment succeeds, before the order webhook finishes) and lists the
 * take-home prints from the basket snapshot.
 */
import { NextRequest, NextResponse } from 'next/server';
import { retrievePaymentIntent } from '@/lib/stripe-server';
import { serviceClient } from '@/lib/qr/server';
import { isStallProductId, stallSizeFromProductId } from '@/lib/cart/items';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const piId = request.nextUrl.searchParams.get('pi') || '';
  if (!/^pi_[A-Za-z0-9]+$/.test(piId)) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  let pi: any;
  try { pi = await retrievePaymentIntent(piId); } catch { return NextResponse.json({ error: 'Not found' }, { status: 404 }); }
  if (pi?.metadata?.salesChannel !== 'stall_online_payment') return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const supabase = serviceClient();
  const [{ data: snapshot }, { data: loc }, { data: order }] = await Promise.all([
    supabase.from('pending_checkouts').select('cart').eq('payment_intent_id', piId).maybeSingle(),
    pi.metadata.posLocationId
      ? supabase.from('stock_locations').select('name, code').eq('id', pi.metadata.posLocationId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('orders').select('order_number').eq('payment_intent_id', piId).maybeSingle(),
  ]);

  const cart: any[] = Array.isArray(snapshot?.cart) ? snapshot!.cart : [];
  const takeHome = cart.filter(i => isStallProductId(i.productId));
  const imageIds = takeHome.map(i => i.imageId);
  const { data: images } = imageIds.length
    ? await supabase.from('image_catalog').select('id, public_url, stock_ref').in('id', imageIds)
    : { data: [] as any[] };
  const byId = new Map((images ?? []).map((i: any) => [i.id, i]));

  return NextResponse.json({
    status: pi.status,
    paid: pi.status === 'succeeded',
    amountPence: pi.amount,
    paidAt: pi.created * 1000,
    firstName: (pi.metadata.customerName || '').split(' ')[0],
    takeHome: takeHome.map(i => ({
      title: i.imageTitle,
      size: stallSizeFromProductId(i.productId),
      stockRef: byId.get(i.imageId)?.stock_ref ?? null,
      imageUrl: byId.get(i.imageId)?.public_url ?? null,
    })),
    deliveredCount: cart.length - takeHome.length,
    stallName: (loc as any)?.name ?? null,
    orderNumber: order?.order_number ?? null,
    last4: pi.id.slice(-6).toUpperCase(),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
