import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // TODO: Add admin authentication check
    const { id } = await params;

    // Use service role client for admin access
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get partner's personal referral code
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('personal_referral_code, business_name, first_name, last_name')
      .eq('id', id)
      .single();

    if (partnerError || !partner || !partner.personal_referral_code) {
      return NextResponse.json({
        total_attributed_customers: 0,
        total_attributed_orders: 0,
        total_attributed_revenue: 0,
        by_level: [],
        customers: []
      });
    }

    // Call recursive function to get all attributed customers
    const { data: attributedCustomers, error: customersError } = await supabase
      .rpc('get_attributed_customers', {
        partner_code: partner.personal_referral_code
      });

    if (customersError) {
      console.error('Attribution API: Error calling get_attributed_customers:', customersError);
      return NextResponse.json({
        total_attributed_customers: 0,
        total_attributed_orders: 0,
        total_attributed_revenue: 0,
        by_level: [],
        customers: []
      });
    }

    if (!attributedCustomers || attributedCustomers.length === 0) {
      return NextResponse.json({
        total_attributed_customers: 0,
        total_attributed_orders: 0,
        total_attributed_revenue: 0,
        by_level: [],
        customers: []
      });
    }

    // Get all customer emails
    const customerEmails = attributedCustomers.map((c: any) => c.customer_email);

    // Map customers.id to user_profiles.id for correct admin routing
    // Do a batch lookup to get user_profiles.id by email
    const { data: userProfiles } = await supabase
      .from('user_profiles')
      .select('id, email')
      .in('email', customerEmails)
      .eq('user_type', 'customer');

    // Create email -> user_profiles.id map
    const emailToProfileId = new Map(
      (userProfiles || []).map(up => [up.email, up.id])
    );

    // Update customer_id to use user_profiles.id
    attributedCustomers.forEach((customer: any) => {
      const profileId = emailToProfileId.get(customer.customer_email);
      if (profileId) {
        customer.customer_id = profileId;
      }
    });

    // Get orders from all attributed customers
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, customer_email, subtotal_amount, created_at')
      .in('customer_email', customerEmails)
      .eq('payment_status', 'paid');

    const totalOrders = orders?.length || 0;
    const totalRevenue = orders?.reduce((sum, order) => sum + (order.subtotal_amount || 0), 0) || 0;

    // Calculate breakdown by referral level
    const levelBreakdown: { [key: number]: { customers: number; orders: number; revenue: number } } = {};

    attributedCustomers.forEach((customer: any) => {
      const level = customer.referral_level;
      if (!levelBreakdown[level]) {
        levelBreakdown[level] = { customers: 0, orders: 0, revenue: 0 };
      }
      levelBreakdown[level].customers++;

      // Count orders and revenue for this customer
      const customerOrders = orders?.filter(o => o.customer_email === customer.customer_email) || [];
      levelBreakdown[level].orders += customerOrders.length;
      levelBreakdown[level].revenue += customerOrders.reduce((sum, o) => sum + (o.subtotal_amount || 0), 0);
    });

    // Convert to array format
    const byLevel = Object.entries(levelBreakdown)
      .map(([level, data]) => ({
        level: parseInt(level),
        customers: data.customers,
        orders: data.orders,
        revenue: data.revenue
      }))
      .sort((a, b) => a.level - b.level);

    // Enhanced customer data with order info
    const customersWithOrders = attributedCustomers.map((customer: any) => {
      const customerOrders = orders?.filter(o => o.customer_email === customer.customer_email) || [];
      return {
        ...customer,
        order_count: customerOrders.length,
        total_revenue: customerOrders.reduce((sum, o) => sum + (o.subtotal_amount || 0), 0)
      };
    });

    return NextResponse.json({
      total_attributed_customers: attributedCustomers.length,
      total_attributed_orders: totalOrders,
      total_attributed_revenue: totalRevenue,
      by_level: byLevel,
      customers: customersWithOrders
    });
  } catch (error) {
    console.error('Error fetching partner attribution:', error);
    return NextResponse.json(
      { error: 'Failed to fetch partner attribution' },
      { status: 500 }
    );
  }
}
