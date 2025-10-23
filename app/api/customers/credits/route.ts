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

    // Fetch active credit packs from database configuration
    const { data: creditPacksData, error: packsError } = await supabaseAdmin
      .from('customer_credit_pack_config')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (packsError) {
      console.error('Error fetching credit packs:', packsError);
    }

    // Format credit packs for response
    const creditPacks = (creditPacksData || []).map((pack: any) => ({
      id: pack.pack_id,
      name: pack.pack_name,
      credits: pack.credits_amount,
      price: pack.price_pence,
      currency: pack.price_currency,
      priceFormatted: `£${(pack.price_pence / 100).toFixed(2)}`,
      orderCredit: pack.order_credit_pence,
      orderCreditFormatted: `£${(pack.order_credit_pence / 100).toFixed(2)}`,
      perCreditCost: pack.price_pence / 100 / pack.credits_amount,
      discount: pack.discount_percentage,
      recommended: pack.is_recommended,
      bestValue: pack.discount_percentage >= 30
    }));

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
      creditPacks: creditPacks
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
 * Deprecated: Use /api/customers/credits/checkout instead
 * Kept for backwards compatibility
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'This endpoint is deprecated. Use /api/customers/credits/checkout instead.' },
    { status: 410 }
  );
}
