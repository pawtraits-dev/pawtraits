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
    
    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    const { data: partner, error } = await supabase
      .from('partners')
      .select('*')
      .eq('id', id)
      .not('business_name', 'is', null) // Ensure this is a real business partner
      .single();

    if (error) throw error;

    if (!partner) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Enhance partner data with analytics like the overview API
    // Get scan data directly from pre_registration_codes table using service role
    const { data: preRegCodes } = await supabase
      .from('pre_registration_codes')
      .select('scans_count')
      .eq('partner_id', partner.id);

    const totalScans = preRegCodes ? preRegCodes.reduce((sum, code) => sum + (code.scans_count || 0), 0) : 0;

    // Get signup data from customers table using service role
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('partner_id', partner.id)
      .single();

    const { data: referredCustomers } = await supabase
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
      const customerEmails = await supabase
        .from('customers')
        .select('email')
        .eq('referral_type', 'PARTNER')
        .eq('referrer_id', userProfile?.id || '');

      if (customerEmails.data && customerEmails.data.length > 0) {
        const emails = customerEmails.data.map(c => c.email).filter(Boolean);

        if (emails.length > 0) {
          // Get orders from these customers
          const { data: orders } = await supabase
            .from('orders')
            .select('id, subtotal_amount')
            .in('customer_email', emails);

          ordersCount = orders ? orders.length : 0;
          ordersValue = orders ? orders.reduce((sum, order) => sum + (order.subtotal_amount || 0), 0) : 0;
        }
      }
    }

    // Get commission data from client_orders table
    const { data: commissionRecords } = await supabase
      .from('client_orders')
      .select('commission_amount, commission_paid')
      .eq('partner_id', partner.id);

    const totalCommissions = commissionRecords
      ? commissionRecords.reduce((sum, record) => sum + (record.commission_amount || 0), 0)
      : 0;

    const paidCommissions = commissionRecords
      ? commissionRecords.filter(r => r.commission_paid).reduce((sum, record) => sum + (record.commission_amount || 0), 0)
      : 0;

    const analytics = {
      total_scans: totalScans,
      total_signups: totalSignups,
      total_orders: ordersCount,
      total_order_value: ordersValue,
      total_commissions: totalCommissions,
      paid_commissions: paidCommissions,
      unpaid_commissions: totalCommissions - paidCommissions
    };

    const enhancedPartner = {
      ...partner,
      full_name: `${partner.first_name || ''} ${partner.last_name || ''}`.trim(),
      approval_status: partner.approval_status || 'pending' as const,
      total_referrals: analytics.total_scans,
      successful_referrals: analytics.total_signups,
      total_orders: analytics.total_orders,
      total_order_value: analytics.total_order_value,
      total_commissions: analytics.total_commissions,
      paid_commissions: analytics.paid_commissions,
      unpaid_commissions: analytics.unpaid_commissions
    };

    return NextResponse.json(enhancedPartner);
  } catch (error) {
    console.error('Error fetching partner:', error);
    return NextResponse.json(
      { error: 'Failed to fetch partner' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // TODO: Add admin authentication check
    const { id } = await params;
    const body = await request.json();
    
    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    const { data, error } = await supabase
      .from('partners')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // TODO: Log admin action
    // await logAdminAction(adminId, 'update_partner', 'partner', params.id, oldData, data);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating partner:', error);
    return NextResponse.json(
      { error: 'Failed to update partner' },
      { status: 500 }
    );
  }
}