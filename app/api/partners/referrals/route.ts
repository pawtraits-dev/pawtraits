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
      .select('business_name, first_name, last_name, email, personal_referral_code, personal_qr_code_url, referral_scans_count')
      .eq('id', partnerId)
      .single();

    if (partnerError || !partner) {
      console.error('Error fetching partner details:', partnerError);
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Get pre-registration codes for this partner (all statuses for accurate scan count)
    const { data: allPreRegCodes, error: preRegError } = await supabase
      .from('pre_registration_codes')
      .select('code, qr_code_url, status, scans_count, conversions_count, created_at')
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false });

    // Filter to active codes for display
    const preRegCodes = allPreRegCodes?.filter(code => code.status === 'active') || [];

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

    // If no pre-reg code, use personal referral code (partner personal codes refer customers, not partners)
    if (!primaryCode && partner.personal_referral_code) {
      primaryCode = {
        code: partner.personal_referral_code,
        qr_code_url: partner.personal_qr_code_url || null,
        type: 'personal' as const,
        scans_count: partner.referral_scans_count || 0,
        conversions_count: 0,
        share_url: `/c/${partner.personal_referral_code}`
      };

      allCodes.push(primaryCode);
    }

    // Get referral analytics using proven query pattern from /admin/partners

    // 1. Get total scans - use partner's referral_scans_count (customer scans after activation)
    // This tracks scans of the partner's active referral code (either converted pre-reg or personal code)
    const totalScans = partner.referral_scans_count || 0;

    // 2. Get signup data from customers table
    const { data: userProfileData } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('partner_id', partnerId)
      .single();

    const { data: referredCustomers } = await supabase
      .from('customers')
      .select('id, email')
      .eq('referral_type', 'PARTNER')
      .eq('referrer_id', userProfileData?.id || '');

    const totalSignups = referredCustomers ? referredCustomers.length : 0;

    // 3. Get order data from referred customers
    let ordersCount = 0;
    let ordersValue = 0;

    if (referredCustomers && referredCustomers.length > 0) {
      const emails = referredCustomers.map(c => c.email).filter(Boolean);

      if (emails.length > 0) {
        const { data: orders } = await supabase
          .from('orders')
          .select('id, subtotal_amount')
          .in('customer_email', emails);

        ordersCount = orders ? orders.length : 0;
        ordersValue = orders ? orders.reduce((sum, order) => sum + (order.subtotal_amount || 0), 0) : 0;
      }
    }

    // 4. Get commission data from commissions table
    const { data: commissionRecords } = await supabase
      .from('commissions')
      .select('commission_amount, status')
      .eq('recipient_id', partnerId)
      .eq('recipient_type', 'partner');

    const totalCommissions = commissionRecords
      ? commissionRecords.reduce((sum, record) => sum + (record.commission_amount || 0), 0)
      : 0;

    const paidCommissions = commissionRecords
      ? commissionRecords.filter(r => r.status === 'paid').reduce((sum, record) => sum + (record.commission_amount || 0), 0)
      : 0;

    const unpaidCommissions = totalCommissions - paidCommissions;

    const analytics = {
      total_scans: totalScans,
      total_referrals: totalSignups,
      total_orders: ordersCount,
      total_value: ordersValue,
      total_commissions: totalCommissions,
      paid_commissions: paidCommissions,
      unpaid_commissions: unpaidCommissions,
      conversion_rate: totalScans > 0 ? (totalSignups / totalScans) : 0,
      avg_order_value: ordersCount > 0 ? (ordersValue / ordersCount) : 0
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
        total_scans: analytics.total_scans,
        total_signups: analytics.total_referrals,
        total_purchases: analytics.total_orders,
        total_order_value: analytics.total_value,
        total_commissions: analytics.total_commissions,
        paid_commissions: analytics.paid_commissions,
        unpaid_commissions: analytics.unpaid_commissions,
        conversion_rate: analytics.conversion_rate,
        avg_order_value: analytics.avg_order_value
      },
      recent_activity: recentActivity,
      commissions: commissionRecords || []
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
