import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    // Authentication using route handler client
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Use service role for database operations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get customer profile
    const { data: userProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id, user_type, email, first_name, last_name')
      .eq('email', user.email)
      .single();

    if (!userProfile || userProfile.user_type !== 'customer') {
      return NextResponse.json({ error: 'Customer account required' }, { status: 403 });
    }

    // Get pack ID from request
    const { packId } = await request.json();

    if (!packId) {
      return NextResponse.json({ error: 'Pack ID is required' }, { status: 400 });
    }

    // Fetch credit pack configuration from database
    const { data: packConfig, error: packError } = await supabaseAdmin
      .from('customer_credit_pack_config')
      .select('*')
      .eq('pack_id', packId)
      .eq('is_active', true)
      .single();

    if (packError || !packConfig) {
      console.error('Error fetching pack config:', packError);
      return NextResponse.json({ error: 'Invalid or inactive credit pack' }, { status: 400 });
    }

    console.log('💳 Creating Stripe checkout for credit pack:', {
      packId: packConfig.pack_id,
      packName: packConfig.pack_name,
      credits: packConfig.credits_amount,
      pricePence: packConfig.price_pence,
      orderCreditPence: packConfig.order_credit_pence,
      customerId: userProfile.id,
      customerEmail: userProfile.email
    });

    // Determine base URL for redirects
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: packConfig.price_currency.toLowerCase(),
            product_data: {
              name: packConfig.pack_name,
              description: `${packConfig.credits_amount} customization credits + £${(packConfig.order_credit_pence / 100).toFixed(2)} order credit`,
              images: [], // Optional: Add product image URL
            },
            unit_amount: packConfig.price_pence,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}/customize?credits_purchased=true&pack=${packId}`,
      cancel_url: `${baseUrl}/customize?credits_purchase_cancelled=true`,
      customer_email: userProfile.email,
      metadata: {
        purchaseType: 'customization_credits',
        customerId: userProfile.id,
        customerEmail: userProfile.email,
        packId: packConfig.pack_id,
        credits: packConfig.credits_amount.toString(),
        orderCreditAmount: packConfig.order_credit_pence.toString(),
        pricePaid: packConfig.price_pence.toString(),
      },
    });

    console.log('✅ Stripe checkout session created:', session.id);

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      checkoutUrl: session.url,
      packDetails: {
        packId: packConfig.pack_id,
        packName: packConfig.pack_name,
        credits: packConfig.credits_amount,
        price: `£${(packConfig.price_pence / 100).toFixed(2)}`,
        orderCredit: `£${(packConfig.order_credit_pence / 100).toFixed(2)}`,
      }
    });

  } catch (error) {
    console.error('💥 Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
