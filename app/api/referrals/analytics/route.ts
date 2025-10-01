import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabaseService = new SupabaseService();

    // Get current user profile using SupabaseService
    const userProfile = await supabaseService.getCurrentUserProfile();
    if (!userProfile) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Check if user type supports referrals
    if (!['partner', 'customer', 'influencer'].includes(userProfile.user_type)) {
      return NextResponse.json({ error: 'Invalid user type for referrals' }, { status: 403 });
    }

    console.log(`🔍 Fetching referral analytics for ${userProfile.user_type}:`, userProfile.id);

    // Use SupabaseService method to get analytics
    const analytics = await supabaseService.getUserReferralAnalytics(userProfile.user_type, userProfile.id);

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