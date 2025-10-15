import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/customers/credits
 * Returns current credit balance and usage statistics for authenticated customer
 */
export async function GET(request: NextRequest) {
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
      .select('id, user_type, email')
      .eq('email', user.email)
      .single();

    if (!userProfile || userProfile.user_type !== 'customer') {
      return NextResponse.json({ error: 'Customer account required' }, { status: 403 });
    }

    const customerId = userProfile.id;

    // Get credit balance using database function
    const { data: balance, error: balanceError } = await supabaseAdmin
      .rpc('get_customer_credit_balance', {
        p_customer_id: customerId
      });

    if (balanceError) {
      console.error('Error fetching credit balance:', balanceError);
      return NextResponse.json({ error: 'Failed to fetch credit balance' }, { status: 500 });
    }

    // Get recent generations
    const { data: recentGenerations, error: generationsError } = await supabaseAdmin
      .from('customer_generated_images')
      .select('id, created_at, is_purchased, generation_cost_credits')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (generationsError) {
      console.error('Error fetching recent generations:', generationsError);
    }

    return NextResponse.json({
      customerId: customerId,
      credits: balance && balance.length > 0 ? {
        remaining: balance[0].credits_remaining || 0,
        purchased: balance[0].credits_purchased || 0,
        used: balance[0].credits_used || 0,
        totalGenerations: balance[0].total_generations || 0,
        totalSpent: balance[0].total_spent_amount || 0
      } : {
        remaining: 2, // Free trial credits for new customers
        purchased: 0,
        used: 0,
        totalGenerations: 0,
        totalSpent: 0
      },
      recentGenerations: recentGenerations || [],
      creditPacks: [
        {
          id: 'starter',
          name: 'Starter Pack',
          credits: 5,
          price: 999, // £9.99 in pence
          currency: 'GBP',
          priceFormatted: '£9.99',
          perCreditCost: 1.998,
          discount: 0
        },
        {
          id: 'popular',
          name: 'Popular Pack',
          credits: 15,
          price: 2499, // £24.99 in pence
          currency: 'GBP',
          priceFormatted: '£24.99',
          perCreditCost: 1.666,
          discount: 17,
          recommended: true
        },
        {
          id: 'pro',
          name: 'Pro Pack',
          credits: 50,
          price: 6999, // £69.99 in pence
          currency: 'GBP',
          priceFormatted: '£69.99',
          perCreditCost: 1.400,
          discount: 30,
          bestValue: true
        }
      ]
    });

  } catch (error) {
    console.error('Credits API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch credits' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/customers/credits
 * Initiates credit purchase flow via Stripe Checkout
 *
 * Body: { packId: 'starter' | 'popular' | 'pro' }
 */
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

    const body = await request.json();
    const { packId } = body;

    if (!packId || !['starter', 'popular', 'pro'].includes(packId)) {
      return NextResponse.json({ error: 'Invalid pack ID' }, { status: 400 });
    }

    // Define credit packs
    const creditPacks: Record<string, { credits: number; price: number; name: string }> = {
      starter: { credits: 5, price: 999, name: 'Starter Pack - 5 Credits' },
      popular: { credits: 15, price: 2499, name: 'Popular Pack - 15 Credits (17% off)' },
      pro: { credits: 50, price: 6999, name: 'Pro Pack - 50 Credits (30% off)' }
    };

    const selectedPack = creditPacks[packId];

    // Import Stripe only when needed
    const Stripe = await import('stripe');
    const stripe = new Stripe.default(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-12-18.acacia',
    });

    // Create Stripe Checkout Session
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: selectedPack.name,
              description: `${selectedPack.credits} customization credits for AI-generated pet portrait variations`,
              images: [`${baseUrl}/images/credit-pack-${packId}.png`] // Optional: add pack images
            },
            unit_amount: selectedPack.price
          },
          quantity: 1
        }
      ],
      mode: 'payment',
      success_url: `${baseUrl}/customer/customize?credits_purchased=true&pack=${packId}`,
      cancel_url: `${baseUrl}/customer/customize?credits_purchase_cancelled=true`,
      customer_email: user.email,
      metadata: {
        customerId: userProfile.id,
        packId: packId,
        credits: selectedPack.credits.toString(),
        purchaseType: 'customization_credits'
      }
    });

    console.log('✅ Stripe checkout session created:', session.id);

    return NextResponse.json({
      sessionId: session.id,
      checkoutUrl: session.url,
      packDetails: {
        packId: packId,
        credits: selectedPack.credits,
        price: selectedPack.price,
        priceFormatted: `£${(selectedPack.price / 100).toFixed(2)}`
      }
    });

  } catch (error) {
    console.error('Credit purchase error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to initiate purchase' },
      { status: 500 }
    );
  }
}
