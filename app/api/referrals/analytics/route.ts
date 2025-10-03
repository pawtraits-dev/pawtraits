import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SupabaseService } from '@/lib/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    // Create service role client for database operations
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get authorization header
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Get user from token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authorization' },
        { status: 401 }
      );
    }

    // Get user profile to determine user type
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('user_type, partner_id, customer_id')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    // Check if user type supports referrals
    if (!['partner', 'customer', 'influencer'].includes(userProfile.user_type)) {
      return NextResponse.json({ error: 'Invalid user type for referrals' }, { status: 403 });
    }

    console.log(`🔍 Fetching referral analytics for ${userProfile.user_type}:`, userProfile.partner_id || userProfile.customer_id);

    // Use SupabaseService method to get analytics (this doesn't require auth, just data fetching)
    const supabaseService = new SupabaseService();
    const analytics = await supabaseService.getUserReferralAnalytics(
      userProfile.user_type,
      userProfile.partner_id || userProfile.customer_id || user.id
    );

    if (!analytics) {
      return NextResponse.json({ error: 'Failed to fetch referral analytics' }, { status: 500 });
    }

    return NextResponse.json(analytics);

  } catch (error) {
    console.error('💥 Error fetching referral analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch referral analytics' },
      { status: 500 }
    );
  }
}