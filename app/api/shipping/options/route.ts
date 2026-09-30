import { NextRequest, NextResponse } from 'next/server';
import { shippingQuoteFor } from '@/lib/shipping/rates';

/**
 * Delivery options for a basket. Public (no auth): rates are public information.
 *
 * Self-printed orders go Royal Mail Tracked at one flat charge per order by destination
 * (lib/shipping/rates.ts) — size and number of prints don't matter, so only the country is needed.
 * Apple Pay / Google Pay share just the country and postcode before the customer pays, which is enough.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const shippingAddress = body?.shippingAddress;
    const cartItems = body?.cartItems;

    if (!shippingAddress || !Array.isArray(cartItems)) {
      return NextResponse.json(
        { error: 'Invalid request data. Shipping address and cart items are required.' },
        { status: 400 }
      );
    }

    const country = String(shippingAddress.country || '').trim();
    if (!country) {
      return NextResponse.json({ error: 'Missing required shipping address field: country' }, { status: 400 });
    }

    const quote = shippingQuoteFor(country);
    if (!quote) {
      return NextResponse.json({ error: 'Sorry — we don’t deliver to this country yet.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      shippingOptions: [quote],
      shippingAddress,
    });
  } catch (error: any) {
    console.error('🚚 [SHIPPING API] Unexpected error:', error);
    return NextResponse.json({ error: 'Failed to fetch shipping options' }, { status: 500 });
  }
}
