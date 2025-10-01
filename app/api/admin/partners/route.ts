import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    // TODO: Add admin authentication check
    // For now, we'll allow access - in production, verify admin role

    console.log('Admin partners API: Fetching partners using service role client...');

    // Use service role client to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get all partners using service role client
    const { data: partners, error: partnersError } = await supabaseAdmin
      .from('partners')
      .select('*')
      .order('created_at', { ascending: false });

    if (partnersError) {
      throw partnersError;
    }

    if (!partners || partners.length === 0) {
      console.log('Admin partners API: No partners found');
      return NextResponse.json([]);
    }

    // Enhance partner data with referral analytics
    const partnersWithData = [];

    for (const partner of partners.filter((p: any) =>
      p.business_name &&
      p.business_name.trim() !== '' &&
      p.business_type &&
      !p.email?.includes('@admin') && // Basic admin email pattern check
      !p.email?.includes('admin@')
    )) {
      // Get scan data directly from pre_registration_codes table using service role
      const { data: preRegCodes, error: preRegError } = await supabaseAdmin
        .from('pre_registration_codes')
        .select('scans_count')
        .eq('partner_id', partner.id);

      const totalScans = preRegCodes ? preRegCodes.reduce((sum, code) => sum + (code.scans_count || 0), 0) : 0;

      // Get signup data from customers table using service role
      const { data: userProfile } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('partner_id', partner.id)
        .single();

      const { data: referredCustomers } = await supabaseAdmin
        .from('customers')
        .select('id')
        .eq('referral_type', 'PARTNER')
        .eq('referrer_id', userProfile?.id || '');

      const totalSignups = referredCustomers ? referredCustomers.length : 0;

      const analytics = {
        summary: {
          total_scans: totalScans,
          total_signups: totalSignups,
          total_commissions: 0, // TODO: Calculate from orders
          total_order_value: 0 // TODO: Calculate from orders
        }
      };

      const totalReferrals = analytics?.summary?.total_scans || 0; // Total scans from pre-registration codes
      const successfulReferrals = analytics?.summary?.total_signups || 0; // Total customer signups using referral codes
      const totalCommissions = analytics?.summary?.total_commissions || 0;
      const paidCommissions = 0; // TODO: Implement commission payment tracking
      const unpaidCommissions = totalCommissions - paidCommissions;

      partnersWithData.push({
        ...partner,
        full_name: `${partner.first_name || ''} ${partner.last_name || ''}`.trim(),
        approval_status: partner.approval_status || 'pending' as const,
        total_referrals: totalReferrals,
        successful_referrals: successfulReferrals,
        total_commissions: totalCommissions,
        paid_commissions: paidCommissions,
        unpaid_commissions: unpaidCommissions
      });
    }

    const data = partnersWithData;

    console.log('Admin partners API: Found', data?.length || 0, 'partners (after filtering)');
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching partners for admin:', error);
    return NextResponse.json(
      { error: 'Failed to fetch partners' },
      { status: 500 }
    );
  }
}