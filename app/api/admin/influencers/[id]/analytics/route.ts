import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // TODO: Add admin authentication check
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30'; // days
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    console.log('Admin influencer analytics API: Fetching analytics for:', id);

    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify influencer exists
    const { data: influencer, error: influencerError } = await supabase
      .from('influencers')
      .select('id, first_name, last_name, created_at')
      .eq('id', id)
      .single();

    if (influencerError || !influencer) {
      return NextResponse.json(
        { error: 'Influencer not found' },
        { status: 404 }
      );
    }

    // Calculate date range
    let dateFilter = '';
    if (startDate && endDate) {
      dateFilter = `and created_at >= '${startDate}' and created_at <= '${endDate}'`;
    } else {
      const days = parseInt(period);
      const date = new Date();
      date.setDate(date.getDate() - days);
      dateFilter = `and created_at >= '${date.toISOString()}'`;
    }

    // Get referral analytics using raw SQL for complex queries
    const { data: referralAnalytics, error: analyticsError } = await supabase
      .rpc('get_influencer_analytics', {
        influencer_uuid: id,
        days_back: parseInt(period)
      });

    // Fallback to manual queries if RPC doesn't exist
    let analytics = referralAnalytics;
    if (analyticsError || !analytics) {
      console.log('Using fallback analytics queries...');

      // Get referral codes
      const { data: codes } = await supabase
        .from('influencer_referral_codes')
        .select('*')
        .eq('influencer_id', id);

      // Get referrals
      const { data: referrals } = await supabase
        .from('influencer_referrals')
        .select('*')
        .eq('influencer_id', id);

      // Get social channels
      const { data: socialChannels } = await supabase
        .from('influencer_social_channels')
        .select('*')
        .eq('influencer_id', id);

      // Calculate basic analytics
      const totalReferrals = referrals?.length || 0;
      const successfulReferrals = referrals?.filter(r => ['purchased', 'credited'].includes(r.status)).length || 0;
      const pendingReferrals = referrals?.filter(r => ['pending', 'accessed', 'signed_up'].includes(r.status)).length || 0;

      const totalRevenue = referrals?.reduce((sum, r) => sum + (r.order_value || 0), 0) || 0;
      const totalCommission = referrals?.reduce((sum, r) => sum + (r.commission_amount || 0), 0) || 0;
      const paidCommission = referrals?.filter(r => r.commission_paid).reduce((sum, r) => sum + (r.commission_amount || 0), 0) || 0;

      const totalSocialReach = socialChannels?.filter(c => c.is_active).reduce((sum, c) => sum + (c.follower_count || 0), 0) || 0;
      const avgEngagementRate = socialChannels?.filter(c => c.is_active && c.engagement_rate > 0).reduce((sum, c, _, arr) => sum + c.engagement_rate / arr.length, 0) || 0;

      analytics = {
        period_days: parseInt(period),
        total_codes: codes?.length || 0,
        active_codes: codes?.filter(c => c.is_active).length || 0,
        total_referrals: totalReferrals,
        successful_referrals: successfulReferrals,
        pending_referrals: pendingReferrals,
        conversion_rate: totalReferrals > 0 ? successfulReferrals / totalReferrals : 0,
        total_revenue: totalRevenue,
        total_commission_earned: totalCommission,
        commission_paid: paidCommission,
        commission_pending: totalCommission - paidCommission,
        avg_order_value: successfulReferrals > 0 ? totalRevenue / successfulReferrals : 0,
        total_social_reach: totalSocialReach,
        avg_engagement_rate: avgEngagementRate,
        active_social_channels: socialChannels?.filter(c => c.is_active).length || 0
      };
    }

    // Get recent activity (last 10 referrals)
    const { data: recentReferrals } = await supabase
      .from('influencer_referrals')
      .select(`
        id,
        customer_email,
        status,
        order_value,
        commission_amount,
        source_platform,
        created_at,
        purchased_at
      `)
      .eq('influencer_id', id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get performance by platform
    const { data: platformPerformance } = await supabase
      .from('influencer_referrals')
      .select('source_platform, status, order_value, commission_amount')
      .eq('influencer_id', id)
      .not('source_platform', 'is', null);

    // Group platform performance
    const platformStats = platformPerformance?.reduce((acc: any, referral) => {
      const platform = referral.source_platform || 'unknown';
      if (!acc[platform]) {
        acc[platform] = {
          total_referrals: 0,
          successful_referrals: 0,
          total_revenue: 0,
          total_commission: 0
        };
      }
      acc[platform].total_referrals++;
      if (['purchased', 'credited'].includes(referral.status)) {
        acc[platform].successful_referrals++;
        acc[platform].total_revenue += referral.order_value || 0;
        acc[platform].total_commission += referral.commission_amount || 0;
      }
      return acc;
    }, {}) || {};

    // Calculate monthly trends (last 6 months)
    const monthlyTrends = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59).toISOString();

      const monthReferrals = referralAnalytics || [];
      const monthData = monthReferrals.filter((r: any) =>
        r.created_at >= monthStart && r.created_at <= monthEnd
      );

      monthlyTrends.push({
        month: date.toISOString().slice(0, 7), // YYYY-MM format
        referrals: monthData.length,
        conversions: monthData.filter((r: any) => ['purchased', 'credited'].includes(r.status)).length,
        revenue: monthData.reduce((sum: number, r: any) => sum + (r.order_value || 0), 0),
        commission: monthData.reduce((sum: number, r: any) => sum + (r.commission_amount || 0), 0)
      });
    }

    const response = {
      influencer: {
        id: influencer.id,
        name: `${influencer.first_name} ${influencer.last_name}`,
        member_since: influencer.created_at
      },
      period: {
        days: parseInt(period),
        start_date: startDate || new Date(Date.now() - (parseInt(period) * 24 * 60 * 60 * 1000)).toISOString(),
        end_date: endDate || new Date().toISOString()
      },
      overview: analytics,
      recent_activity: recentReferrals || [],
      platform_performance: platformStats,
      monthly_trends: monthlyTrends
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching influencer analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}