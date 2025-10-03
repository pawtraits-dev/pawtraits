import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No auth header found for partner referrals');
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get user from token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: 'Invalid authorization' },
        { status: 401 }
      );
    }

    const partnerId = user.id; // Partner ID is the user ID

    console.log('Partner referrals API: Fetching referral data for partner:', partnerId);

    // Get partner details
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('business_name, first_name, last_name, email, personal_referral_code')
      .eq('id', partnerId)
      .single();

    if (partnerError || !partner) {
      console.error('Error fetching partner details:', partnerError);
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Get pre-registration codes for this partner
    const { data: preRegCodes, error: preRegError } = await supabase
      .from('pre_registration_codes')
      .select('code, qr_code_url, status, scans_count, conversions_count, created_at')
      .eq('partner_id', partnerId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (preRegError) {
      console.warn('Error fetching pre-registration codes:', preRegError);
    }

    // Determine primary referral code (pre-reg takes priority)
    let primaryCode = null;
    let allCodes = [];

    if (preRegCodes && preRegCodes.length > 0) {
      // Use first pre-registration code as primary
      primaryCode = {
        code: preRegCodes[0].code,
        qr_code_url: preRegCodes[0].qr_code_url,
        type: 'pre_registration' as const,
        scans_count: preRegCodes[0].scans_count || 0,
        conversions_count: preRegCodes[0].conversions_count || 0,
        share_url: `/p/${preRegCodes[0].code}`,
        created_at: preRegCodes[0].created_at
      };

      allCodes = preRegCodes.map(code => ({
        code: code.code,
        qr_code_url: code.qr_code_url,
        type: 'pre_registration' as const,
        scans_count: code.scans_count || 0,
        conversions_count: code.conversions_count || 0,
        share_url: `/p/${code.code}`,
        created_at: code.created_at
      }));
    }

    // If no pre-reg code, use personal referral code
    if (!primaryCode && partner.personal_referral_code) {
      primaryCode = {
        code: partner.personal_referral_code,
        qr_code_url: null,
        type: 'personal' as const,
        scans_count: 0,
        conversions_count: 0,
        share_url: `/p/${partner.personal_referral_code}`
      };

      allCodes.push(primaryCode);
    }

    // Get referral analytics via RPC function
    const { data: analyticsData, error: analyticsError } = await supabase
      .rpc('get_partner_referral_analytics', { p_partner_id: partnerId });

    if (analyticsError) {
      console.error('Error fetching referral analytics:', analyticsError);
    }

    const analytics = analyticsData || {
      total_scans: 0,
      total_referrals: 0,
      total_orders: 0,
      total_value: 0,
      total_commissions: 0,
      conversion_rate: 0,
      avg_order_value: 0
    };

    // Get recent referral activity (last 20 events)
    const { data: referralActivity, error: activityError } = await supabase
      .from('customer_referrals')
      .select(`
        id,
        created_at,
        status,
        commission_earned,
        customers:customer_id (
          email,
          first_name,
          last_name
        )
      `)
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (activityError) {
      console.warn('Error fetching referral activity:', activityError);
    }

    const recentActivity = (referralActivity || []).map(ref => ({
      id: ref.id,
      type: ref.status === 'completed' ? 'purchase' : 'signup',
      date: ref.created_at,
      customer_name: ref.customers
        ? `${ref.customers.first_name || ''} ${ref.customers.last_name || ''}`.trim()
        : 'Unknown Customer',
      commission: ref.commission_earned || 0,
      status: ref.status
    }));

    const response = {
      user_type: 'partner',
      partner_name: partner.business_name || `${partner.first_name} ${partner.last_name}`,
      primary_code: primaryCode,
      all_codes: allCodes,
      summary: {
        total_scans: analytics.total_scans || 0,
        total_signups: analytics.total_referrals || 0,
        total_purchases: analytics.total_orders || 0,
        total_order_value: analytics.total_value || 0,
        total_commissions: analytics.total_commissions || 0,
        conversion_rate: analytics.conversion_rate || 0,
        avg_order_value: analytics.avg_order_value || 0
      },
      recent_activity: recentActivity
    };

    console.log('Partner referrals API: Returning referral data for partner', partnerId);
    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching partner referral data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch referral data' },
      { status: 500 }
    );
  }
}
