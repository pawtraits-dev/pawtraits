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

      // Get order data: orders → customers (via email) → partners (via referrer_id)
      let ordersCount = 0;
      let ordersValue = 0;

      if (referredCustomers && referredCustomers.length > 0) {
        // Get emails of all referred customers
        const customerEmails = await supabaseAdmin
          .from('customers')
          .select('email')
          .eq('referral_type', 'PARTNER')
          .eq('referrer_id', userProfile?.id || '');

        if (customerEmails.data && customerEmails.data.length > 0) {
          const emails = customerEmails.data.map(c => c.email).filter(Boolean);

          if (emails.length > 0) {
            // Get orders from these customers
            const { data: orders } = await supabaseAdmin
              .from('orders')
              .select('id, subtotal_amount')
              .in('customer_email', emails);

            ordersCount = orders ? orders.length : 0;
            ordersValue = orders ? orders.reduce((sum, order) => sum + (order.subtotal_amount || 0), 0) : 0;
          }
        }
      }

      // Get commission data from new commissions table
      const { data: commissionRecords } = await supabaseAdmin
        .from('commissions')
        .select('commission_amount, status')
        .eq('recipient_id', userProfile?.id || '')
        .eq('recipient_type', 'partner');

      const totalCommissions = commissionRecords
        ? commissionRecords.reduce((sum, record) => sum + (record.commission_amount || 0), 0)
        : 0;

      const paidCommissions = commissionRecords
        ? commissionRecords.filter(r => r.status === 'paid').reduce((sum, record) => sum + (record.commission_amount || 0), 0)
        : 0;

      const analytics = {
        summary: {
          total_scans: totalScans,
          total_signups: totalSignups,
          total_orders: ordersCount,
          total_order_value: ordersValue,
          total_commissions: totalCommissions,
          paid_commissions: paidCommissions,
          unpaid_commissions: totalCommissions - paidCommissions
        }
      };

      const totalReferrals = analytics?.summary?.total_scans || 0; // Total scans from pre-registration codes
      const successfulReferrals = analytics?.summary?.total_signups || 0; // Total customer signups using referral codes
      const totalOrders = analytics?.summary?.total_orders || 0; // Total orders from referred customers
      const totalOrderValue = analytics?.summary?.total_order_value || 0; // Total order value from referred customers
      const partnerTotalCommissions = analytics?.summary?.total_commissions || 0;
      const partnerPaidCommissions = analytics?.summary?.paid_commissions || 0;
      const partnerUnpaidCommissions = analytics?.summary?.unpaid_commissions || 0;

      partnersWithData.push({
        ...partner,
        full_name: `${partner.first_name || ''} ${partner.last_name || ''}`.trim(),
        approval_status: partner.approval_status || 'pending' as const,
        total_referrals: totalReferrals,
        successful_referrals: successfulReferrals,
        total_orders: totalOrders,
        total_order_value: totalOrderValue,
        total_commissions: partnerTotalCommissions,
        paid_commissions: partnerPaidCommissions,
        unpaid_commissions: partnerUnpaidCommissions
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