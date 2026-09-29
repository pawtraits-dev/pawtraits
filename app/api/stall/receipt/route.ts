/**
 * GET /api/stall/receipt?pi=pi_...
 * Proof-of-payment screen data. Checks Stripe directly, so it shows PAID the moment the
 * payment succeeds (even before the order webhook has finished).
 */
import { NextRequest, NextResponse } from 'next/server';
import { retrievePaymentIntent } from '@/lib/stripe-server';
import { serviceClient } from '@/lib/qr/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const piId = request.nextUrl.searchParams.get('pi') || '';
  if (!/^pi_[A-Za-z0-9]+$/.test(piId)) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  let pi: any;
  try { pi = await retrievePaymentIntent(piId); } catch { return NextResponse.json({ error: 'Not found' }, { status: 404 }); }
  if (pi?.metadata?.salesChannel !== 'stall_online_payment') return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const supabase = serviceClient();
  const [{ data: image }, { data: loc }, { data: order }] = await Promise.all([
    supabase.from('image_catalog').select('public_url, description, stock_ref').eq('id', pi.metadata.item1_id).maybeSingle(),
    supabase.from('stock_locations').select('name, code').eq('id', pi.metadata.posLocationId).maybeSingle(),
    supabase.from('orders').select('order_number').eq('payment_intent_id', piId).maybeSingle(),
  ]);

  return NextResponse.json({
    status: pi.status,                       // 'succeeded' | 'processing' | 'requires_payment_method' ...
    paid: pi.status === 'succeeded',
    amountPence: pi.amount,
    paidAt: pi.created * 1000,
    firstName: (pi.metadata.customerName || '').split(' ')[0],
    size: pi.metadata.stallSize,
    stockRef: image?.stock_ref ?? pi.metadata.stockRef,
    imageUrl: image?.public_url ?? null,
    title: image?.description ?? 'Pawtraits print',
    stallName: loc?.name ?? null,
    orderNumber: order?.order_number ?? null,
    last4: pi.id.slice(-6).toUpperCase(),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
