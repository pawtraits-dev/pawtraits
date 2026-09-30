import { NextRequest, NextResponse } from 'next/server';
import { createPaymentIntent } from '@/lib/stripe-server';
import { getSupabaseClient } from '@/lib/supabase-client';
import { checkoutValidation } from '@/lib/checkout-validation';
import { QR_ATTRIBUTION_COOKIE, VISITOR_COOKIE, decodeAttribution, validVisitorId } from '@/lib/qr/attribution';
import { CONSENT_COOKIE, parseConsent } from '@/lib/tracking/consent';
import { serviceClient } from '@/lib/qr/server';
import { isStallProductId, stallSizeFromProductId } from '@/lib/cart/items';
import { getStallOffer } from '@/lib/stall/offer';

interface CreatePaymentIntentRequest {
  amount: number; // in pence
  currency?: string;
  customerEmail: string; // Will be client email for partner-client orders
  customerName: string;  // Will be client name for partner-client orders
  // Optional: who actually placed the order (partner email when different from customer)
  placedByEmail?: string;
  userType?: 'customer' | 'partner'; // User type of person placing order
  shippingAddress: {
    firstName: string;
    lastName: string;
    address: string; // Keep for backward compatibility
    addressLine1?: string; // New field
    addressLine2?: string; // New field
    city: string;
    postcode: string;
    country: string;
    businessName?: string;
    isForClient?: boolean;
    clientName?: string;
    clientEmail?: string;
  };
  cartItems: Array<{
    productId: string;
    imageId: string;
    imageTitle: string;
    quantity: number;
    unitPrice: number;
    originalPrice?: number; // For partner discounts
    // Enhanced Gelato data for order fulfillment
    gelatoProductUid?: string;
    printSpecs?: {
      width_cm: number;
      height_cm: number;
      medium: string;
      format: string;
    };
  }>;
  referralCode?: string;
  referralDiscount?: number; // Discount amount in pence
  rewardRedemption?: number; // Reward amount redeemed in pence
  // Shipping option data
  shippingOption?: {
    uid: string;
    name: string;
    price: number; // in minor units (pence)
    currency: string;
    delivery_estimate?: string;
  };
  // Partner-specific fields
  isPartnerOrder?: boolean;
  partnerDiscount?: number; // in pence
  clientInfo?: {
    name: string;
    email: string;
  };
  // Guest checkout extras
  customerPhone?: string;
  marketingOptIn?: boolean;
  digitalOnly?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: CreatePaymentIntentRequest = await request.json();
    
    // Enhanced validation with detailed error messages
    const validationErrors: string[] = [];
    
    if (!body.amount || body.amount <= 0) {
      validationErrors.push(`amount (${body.amount})`);
    }
    
    if (!body.customerEmail || body.customerEmail.trim() === '') {
      validationErrors.push(`customerEmail (${body.customerEmail})`);
    }
    
    if (!body.customerName || body.customerName.trim() === '') {
      validationErrors.push(`customerName (${body.customerName})`);
    }
    
    if (validationErrors.length > 0) {
      console.error('PaymentIntent validation failed:', {
        receivedData: {
          amount: body.amount,
          customerEmail: body.customerEmail,
          customerName: body.customerName,
          cartItemsLength: body.cartItems?.length,
          shippingAddress: body.shippingAddress
        },
        validationErrors
      });
      
      return NextResponse.json(
        { 
          error: 'Missing or invalid required fields', 
          details: `Invalid fields: ${validationErrors.join(', ')}`,
          debug: {
            amount: body.amount,
            customerEmail: body.customerEmail || '(empty)',
            customerName: body.customerName || '(empty)'
          }
        },
        { status: 400 }
      );
    }

    // Determine order type using the validation service
    const orderType = checkoutValidation.getOrderType(
      body.userType || 'customer', 
      body.shippingAddress.isForClient || false
    );

    // Create unified metadata structure
    const metadata: Record<string, string> = {
      // Core customer information (client email for partner-client orders)
      customerEmail: body.customerEmail,
      customerName: body.customerName,
      
      // Order attribution
      orderType: orderType,
      placedByEmail: body.placedByEmail || body.customerEmail, // Who actually placed the order
      
      // Cart info
      cartItemCount: body.cartItems?.length.toString() || '0',
    };

    // Add shipping address to metadata
    if (body.shippingAddress) {
      metadata.shippingFirstName = body.shippingAddress.firstName;
      metadata.shippingLastName = body.shippingAddress.lastName;
      
      // Use new address lines if available, fallback to old address field
      if (body.shippingAddress.addressLine1) {
        metadata.shippingAddressLine1 = body.shippingAddress.addressLine1;
        if (body.shippingAddress.addressLine2) {
          metadata.shippingAddressLine2 = body.shippingAddress.addressLine2;
        }
        // Also populate old field for backward compatibility
        const combinedAddress = body.shippingAddress.addressLine2 
          ? `${body.shippingAddress.addressLine1}, ${body.shippingAddress.addressLine2}`
          : body.shippingAddress.addressLine1;
        metadata.shippingAddress = combinedAddress;
      } else {
        // Fallback to old single address field
        metadata.shippingAddress = body.shippingAddress.address;
      }
      
      metadata.shippingCity = body.shippingAddress.city;
      metadata.shippingPostcode = body.shippingAddress.postcode;
      metadata.shippingCountry = body.shippingAddress.country;
    }

    // Add shipping option data to metadata
    if (body.shippingOption) {
      metadata.shippingMethodUid = String((body.shippingOption as any).uid || (body.shippingOption as any).id || '');
      metadata.shippingMethodName = body.shippingOption.name.substring(0, 50);
      metadata.shippingCost = body.shippingOption.price.toString();
      metadata.shippingCurrency = body.shippingOption.currency;
      if (body.shippingOption.delivery_estimate) {
        metadata.shippingDeliveryEstimate = body.shippingOption.delivery_estimate;
      }
    }

    // Add referral code if provided (customer orders only)
    if (body.referralCode && orderType === 'customer') {
      metadata.referralCode = body.referralCode;

      // Add referral discount amount for order processing
      if (body.referralDiscount && body.referralDiscount > 0) {
        metadata.referralDiscount = body.referralDiscount.toString();
        console.log(`🎯 Customer referral discount applied: ${body.referralDiscount} pence for code ${body.referralCode}`);
      }
    }

    // Sticker QR attribution (point-of-sale location) — read from the signed cookie set by /s/*
    const qrAttribution = decodeAttribution(request.cookies.get(QR_ATTRIBUTION_COOKIE)?.value);
    if (qrAttribution) {
      metadata.qrScanId = qrAttribution.scanId;
      if (qrAttribution.locationId) metadata.posLocationId = qrAttribution.locationId;
      console.log('🏷️ QR attribution attached:', { scanId: qrAttribution.scanId, locationId: qrAttribution.locationId });
    }

    // Add reward redemption if provided (customer orders only)
    if (body.rewardRedemption && body.rewardRedemption > 0 && orderType === 'customer') {
      metadata.rewardRedemption = body.rewardRedemption.toString();
      console.log(`💰 Customer reward redemption: ${body.rewardRedemption} pence`);
    }

    // Add partner-specific metadata
    if (orderType.startsWith('partner')) {
      metadata.isPartnerOrder = 'true';
      
      if (body.partnerDiscount) {
        metadata.partnerDiscount = body.partnerDiscount.toString();
      }
      
      if (body.shippingAddress.businessName) {
        metadata.businessName = body.shippingAddress.businessName;
      }
      
      // Partner-client order specific metadata
      if (orderType === 'partner_for_client') {
        metadata.isForClient = 'true';
        metadata.clientName = body.shippingAddress.clientName || body.customerName;
        metadata.clientEmail = body.shippingAddress.clientEmail || body.customerEmail;
        // Partner who placed the order
        metadata.partnerEmail = body.placedByEmail || '';
      }
    }

    // Add cart items to metadata (first 3 items only due to Stripe metadata limits)
    if (body.cartItems && body.cartItems.length > 0) {
      body.cartItems.slice(0, 3).forEach((item, index) => {
        metadata[`item${index + 1}_id`] = item.imageId;
        metadata[`item${index + 1}_product_id`] = item.productId; // Database UUID for order_items
        metadata[`item${index + 1}_title`] = item.imageTitle.substring(0, 50); // Truncate to avoid metadata limit
        metadata[`item${index + 1}_qty`] = item.quantity.toString();
        metadata[`item${index + 1}_unit_price`] = item.unitPrice.toString(); // Store unit price
        // Store original price for discount calculations
        if (item.originalPrice) {
          metadata[`item${index + 1}_original_price`] = item.originalPrice.toString();
        }
        // Enhanced Gelato data for fulfillment
        if (item.gelatoProductUid) {
          metadata[`item${index + 1}_gelato_uid`] = item.gelatoProductUid.substring(0, 100);
        }
        if (item.printSpecs) {
          metadata[`item${index + 1}_width`] = item.printSpecs.width_cm.toString();
          metadata[`item${index + 1}_height`] = item.printSpecs.height_cm.toString();
          metadata[`item${index + 1}_medium`] = item.printSpecs.medium.substring(0, 30);
          metadata[`item${index + 1}_format`] = item.printSpecs.format.substring(0, 30);
        }
      });
    }

    // Stall "take it home now" prints: only after a fresh stall-sticker scan, one each, at the
    // admin-set stall price (never the browser's price)
    const stallItems = (body.cartItems || []).filter(i => isStallProductId(i.productId));
    for (const item of stallItems) {
      const offer = await getStallOffer(request, item.imageId, null);
      if (!offer.available) {
        return NextResponse.json({ error: 'Take-home prints can only be paid for at the stall, after scanning the sticker on the back. Please remove it from your basket to continue.', code: 'STALL_ITEM_UNAVAILABLE' }, { status: 400 });
      }
      if (stallSizeFromProductId(item.productId) !== offer.size || item.quantity !== 1 || item.unitPrice !== offer.pricePence) {
        return NextResponse.json({ error: 'The price of a take-home print has changed — please remove it from your basket and add it again.', code: 'STALL_ITEM_STALE' }, { status: 409 });
      }
    }
    if (stallItems.length) metadata.salesChannel = 'stall_online_payment';

    if (body.customerPhone) metadata.customerPhone = String(body.customerPhone).slice(0, 30);
    if (body.marketingOptIn) metadata.marketingOptIn = 'true';

    // Server-side price floor: the browser sends prices, so check them against the catalogue.
    // Blatant underpayment is HELD (not sent to Gelato) for manual review rather than blocked,
    // so legitimate bundle/referral discounts can never stop a sale.
    const priceCheck = await checkPriceFloor(body);
    metadata.priceCheck = priceCheck.status;
    if (priceCheck.status !== 'ok') {
      console.warn('💷 Price check', priceCheck.status, { amount: body.amount, floor: priceCheck.floor, email: body.customerEmail });
    }

    // Create PaymentIntent
    const paymentIntent = await createPaymentIntent({
      amount: body.amount,
      currency: body.currency || 'gbp',
      customerEmail: body.customerEmail,
      metadata,
      automaticPaymentMethods: true,
    });

    // Log payment intent creation for debugging
    console.log('PaymentIntent created:', {
      id: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      customerEmail: body.customerEmail,
      status: paymentIntent.status,
    });

    // Server-side basket snapshot: the webhook builds order_items from this (all items,
    // not just the 3 that fit in Stripe metadata) and uses the consent/client info for ads
    try {
      const consent = parseConsent(request.cookies.get(CONSENT_COOKIE)?.value);
      await serviceClient().from('pending_checkouts').upsert({
        payment_intent_id: paymentIntent.id,
        customer_email: body.customerEmail.toLowerCase(),
        cart: (body.cartItems || []).map(i => ({
          productId: i.productId, imageId: i.imageId, imageTitle: i.imageTitle,
          quantity: i.quantity, unitPrice: i.unitPrice, originalPrice: i.originalPrice,
        })),
        fulfillment: stallItems.length && stallItems.length === (body.cartItems || []).length ? 'collect'
          : stallItems.length && body.digitalOnly ? 'collect'
          : body.digitalOnly ? 'digital' : 'ship',
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
    } catch (snapshotError) {
      console.error('⚠️ Failed to store basket snapshot (webhook will fall back to metadata):', snapshotError);
    }

    return NextResponse.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
    });

  } catch (error) {
    console.error('Error creating PaymentIntent:', error);
    
    // Handle Stripe-specific errors
    if (error && typeof error === 'object' && 'type' in error) {
      const stripeError = error as any;
      return NextResponse.json(
        { 
          error: 'Payment setup failed', 
          details: stripeError.message || 'Unknown Stripe error',
          type: stripeError.type || 'api_error'
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create payment intent', details: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve a payment intent
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentIntentId = searchParams.get('payment_intent_id');

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: 'Payment intent ID is required' },
        { status: 400 }
      );
    }

    // Get auth token to verify user
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    
    // Verify the user is authenticated
    const supabase = getSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authentication' },
        { status: 401 }
      );
    }

    // Import stripe-server functions for retrieving payment intent
    const { retrievePaymentIntent } = await import('@/lib/stripe-server');
    const paymentIntent = await retrievePaymentIntent(paymentIntentId);

    // Only return payment intent if it belongs to the authenticated user
    const customerEmail = paymentIntent.metadata?.customerEmail;
    if (customerEmail !== user.email) {
      return NextResponse.json(
        { error: 'Payment intent not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      metadata: paymentIntent.metadata,
      created: paymentIntent.created,
    });

  } catch (error) {
    console.error('Error retrieving PaymentIntent:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve payment intent' },
      { status: 500 }
    );
  }
}

/**
 * Compare what the browser says the goods cost with the lowest current catalogue price.
 *  ok         → at or above the floor (after declared discounts)
 *  low        → below, but within 50% (could be a bundle deal) — logged only
 *  suspicious → under half the catalogue price — order is held for review
 */
async function checkPriceFloor(body: CreatePaymentIntentRequest): Promise<{ status: 'ok' | 'low' | 'suspicious' | 'unchecked'; floor: number }> {
  try {
    const items = (body.cartItems || []).filter(i => /^[0-9a-f-]{36}$/i.test(i.productId));
    if (!items.length) return { status: 'unchecked', floor: 0 };
    const currency = (body.currency || 'gbp').toUpperCase();
    const { data: prices } = await serviceClient()
      .from('product_pricing')
      .select('product_id, sale_price, discount_price, is_on_sale, currency_code')
      .in('product_id', Array.from(new Set(items.map(i => i.productId))))
      .eq('is_current', true);
    const min = new Map<string, number>();
    for (const p of prices ?? []) {
      if ((p.currency_code || '').toUpperCase() !== currency) continue;
      const v = p.is_on_sale && p.discount_price ? p.discount_price : p.sale_price;
      if (!min.has(p.product_id) || v < min.get(p.product_id)!) min.set(p.product_id, v);
    }
    let floor = 0;
    for (const i of items) {
      const m = min.get(i.productId);
      if (m === undefined) return { status: 'unchecked', floor: 0 };
      floor += m * i.quantity;
    }
    const declaredDiscounts = (body.referralDiscount || 0) + (body.rewardRedemption || 0) + (body.partnerDiscount || 0);
    const shipping = body.shippingOption?.price || 0;
    const paidForGoods = body.amount - shipping + declaredDiscounts;
    if (paidForGoods >= floor) return { status: 'ok', floor };
    if (paidForGoods >= floor * 0.5) return { status: 'low', floor };
    return { status: 'suspicious', floor };
  } catch (e) {
    console.warn('Price check failed', e);
    return { status: 'unchecked', floor: 0 };
  }
}
