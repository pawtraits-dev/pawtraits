import { NextRequest, NextResponse } from 'next/server';
import { createPaymentIntent } from '@/lib/stripe-server';
import { getSupabaseClient } from '@/lib/supabase-client';

interface CreatePaymentIntentRequest {
  amount: number; // in pence
  currency?: string;
  customerEmail: string;
  customerName: string;
  shippingAddress: {
    firstName: string;
    lastName: string;
    address: string;
    city: string;
    postcode: string;
    country: string;
  };
  cartItems: Array<{
    productId: string;
    imageId: string;
    imageTitle: string;
    quantity: number;
    unitPrice: number;
  }>;
  referralCode?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: CreatePaymentIntentRequest = await request.json();
    
    // Validate required fields
    if (!body.amount || !body.customerEmail || !body.customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: amount, customerEmail, customerName' },
        { status: 400 }
      );
    }

    // Validate amount is positive
    if (body.amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    // Create metadata for the payment
    const metadata: Record<string, string> = {
      customerEmail: body.customerEmail,
      customerName: body.customerName,
      cartItemCount: body.cartItems?.length.toString() || '0',
    };

    // Add shipping address to metadata
    if (body.shippingAddress) {
      metadata.shippingFirstName = body.shippingAddress.firstName;
      metadata.shippingLastName = body.shippingAddress.lastName;
      metadata.shippingAddress = body.shippingAddress.address;
      metadata.shippingCity = body.shippingAddress.city;
      metadata.shippingPostcode = body.shippingAddress.postcode;
      metadata.shippingCountry = body.shippingAddress.country;
    }

    // Add referral code if provided
    if (body.referralCode) {
      metadata.referralCode = body.referralCode;
    }

    // Add cart items to metadata (first 3 items only due to Stripe metadata limits)
    if (body.cartItems && body.cartItems.length > 0) {
      body.cartItems.slice(0, 3).forEach((item, index) => {
        metadata[`item${index + 1}_id`] = item.imageId;
        metadata[`item${index + 1}_title`] = item.imageTitle.substring(0, 50); // Truncate to avoid metadata limit
        metadata[`item${index + 1}_qty`] = item.quantity.toString();
      });
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