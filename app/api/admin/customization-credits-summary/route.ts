import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/admin/customization-credits-summary
 * Returns summary statistics for customer customization credits
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication check
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

    // Verify admin access
    const { data: userProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('user_type')
      .eq('email', user.email)
      .single();

    if (!userProfile || userProfile.user_type !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('📊 Fetching customization credits summary...');

    // Get all customer credit records
    const { data: credits, error: creditsError } = await supabaseAdmin
      .from('customer_customization_credits')
      .select('*');

    if (creditsError) {
      console.error('Error fetching customization credits:', creditsError);
      return NextResponse.json({ error: 'Failed to fetch credits' }, { status: 500 });
    }

    // Calculate aggregate metrics
    const totalCustomers = credits.length;
    const totalCreditsIssued = credits.reduce((sum, c) =>
      sum + (c.credits_purchased + c.free_trial_credits_granted), 0
    );
    const totalCreditsUsed = credits.reduce((sum, c) => sum + c.credits_used, 0);
    const totalGenerations = credits.reduce((sum, c) => sum + c.total_generations, 0);
    const totalRevenue = credits.reduce((sum, c) => sum + (c.total_spent_amount || 0), 0);

    const summary = {
      totalCustomers,
      totalCreditsIssued,
      totalCreditsUsed,
      totalGenerations,
      totalRevenue
    };

    console.log('✅ Customization credits summary:', summary);

    return NextResponse.json(summary);

  } catch (error) {
    console.error('Admin customization credits summary API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch summary' },
      { status: 500 }
    );
  }
}
