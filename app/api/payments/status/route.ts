/**
 * GET /api/payments/status?payment_intent=pi_…
 * Public, minimal status of a payment for the confirmation page, so it can say "Payment received"
 * the moment the customer lands — before the webhook has created the order. Payment intent ids are
 * unguessable; only the status, amount and whether anything is posted are returned.
 */
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('payment_intent') || '';
  if (!/^pi_[A-Za-z0-9]{10,}$/.test(id)) return NextResponse.json({ error: 'Invalid payment' }, { status: 400 });
  try {
    const pi = await stripe.paymentIntents.retrieve(id);
    const m = pi.metadata || {};
    return NextResponse.json({
      status: pi.status, // succeeded | processing | requires_payment_method | …
      amount: pi.amount,
      currency: pi.currency,
      posted: !!(m.shippingAddress || m.shippingAddressLine1),
    });
  } catch {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
  }
}
