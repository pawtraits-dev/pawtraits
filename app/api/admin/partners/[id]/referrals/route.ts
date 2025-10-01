import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // TODO: Add admin authentication check
    const { id } = await params;

    console.log('Admin referrals API: Fetching referrals for partner using SupabaseService:', id);

    const supabaseService = new SupabaseService();

    // Get partner referral analytics using proper service method
    const analytics = await supabaseService.getPartnerReferralAnalytics(id);

    if (!analytics) {
      return NextResponse.json([]);
    }

    // Convert analytics data to legacy referral format for admin compatibility
    const convertedReferrals = analytics.recent_activity?.map((activity: any) => ({
      id: activity.id,
      referral_code: activity.referral_code || 'N/A',
      client_name: activity.client_name || 'Anonymous',
      client_email: activity.client_email || 'N/A',
      status: activity.type === 'purchase' ? 'purchased' : 'accepted',
      commission_rate: activity.commission_rate || 0,
      commission_amount: activity.commission || 0,
      commission_paid: false, // TODO: Implement commission payment tracking
      created_at: activity.date,
      purchased_at: activity.type === 'purchase' ? activity.date : null,
      order_total: activity.order_value || null,
      order_number: activity.order_number || null,
      discount_applied: activity.discount_applied || 0
    })) || [];

    console.log('Admin referrals API: Found', convertedReferrals.length, 'referrals for partner', id);
    return NextResponse.json(convertedReferrals);
  } catch (error) {
    console.error('Error fetching partner referrals for admin:', error);
    return NextResponse.json(
      { error: 'Failed to fetch partner referrals' },
      { status: 500 }
    );
  }
}