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

    // Get customer's personal referral code
    // Note: id parameter is user_profiles.id
    // Must join through user_profiles.customer_id (see docs/ID-RELATIONSHIPS.md)
    const { data: userProfile, error: upError } = await supabase
      .from('user_profiles')
      .select('customer_id')
      .eq('id', id)
      .single();

    if (upError || !userProfile?.customer_id) {
      return NextResponse.json({
        total_attributed_customers: 0,
        total_attributed_orders: 0,
        total_attributed_revenue: 0,
        by_level: [],
        customers: []
      });
    }

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('personal_referral_code, email, first_name, last_name')
      .eq('id', userProfile.customer_id)
      .single();

    if (customerError || !customer || !customer.personal_referral_code) {
      return NextResponse.json({
        total_attributed_customers: 0,
        total_attributed_orders: 0,
        total_attributed_revenue: 0,
        by_level: [],
        customers: []
      });
    }

    // Call recursive function to get all attributed customers (using customer code instead of partner code)
    const { data: attributedCustomers, error: customersError } = await supabase
      .rpc('get_attributed_customers_for_customer', {
        customer_code: customer.personal_referral_code
      });

    if (customersError) {
      console.error('Customer Attribution API: Error calling get_attributed_customers_for_customer:', customersError);
      // If function doesn't exist yet, manually query referral chain
      // Get all customers who used this customer's referral code
      const { data: directReferrals } = await supabase
        .from('customers')
        .select('id, email, first_name, last_name, personal_referral_code, referral_code_used, created_at')
        .eq('referral_code_used', customer.personal_referral_code);

      if (!directReferrals || directReferrals.length === 0) {
        return NextResponse.json({
          total_attributed_customers: 0,
          total_attributed_orders: 0,
          total_attributed_revenue: 0,
          by_level: [],
          customers: []
        });
      }

      // Build referral chain manually
      const buildChain = async (customers: any[], level: number = 1): Promise<any[]> => {
        const result: any[] = [];
        for (const c of customers) {
          // Get user_profiles.id for this customer email
          const { data: userProfile } = await supabase
            .from('user_profiles')
            .select('id')
            .eq('email', c.email)
            .eq('user_type', 'customer')
            .single();

          result.push({
            customer_id: userProfile?.id || c.id,  // Use user_profiles.id, fallback to customers.id
            customer_email: c.email,
            customer_first_name: c.first_name,
            customer_last_name: c.last_name,
            customer_created_at: c.created_at,
            referral_level: level,
            referral_path: `${customer.email} → ${c.email}`,
            referral_code_used: c.referral_code_used
          });

          // Recursively find children
          if (c.personal_referral_code) {
            const { data: children } = await supabase
              .from('customers')
              .select('id, email, first_name, last_name, personal_referral_code, referral_code_used, created_at')
              .eq('referral_code_used', c.personal_referral_code);

            if (children && children.length > 0) {
              const childResults = await buildChain(children, level + 1);
              childResults.forEach(child => {
                child.referral_path = `${customer.email} → ${c.email} → ${child.customer_email}`;
                result.push(child);
              });
            }
          }
        }
        return result;
      };

      const attributedCustomersManual = await buildChain(directReferrals);

      // Get orders for these customers
      const customerEmails = attributedCustomersManual.map((c: any) => c.customer_email);
      const { data: orders } = await supabase
        .from('orders')
        .select('id, customer_email, subtotal_amount, created_at')
        .in('customer_email', customerEmails)
        .eq('payment_status', 'paid');

      const totalOrders = orders?.length || 0;
      const totalRevenue = orders?.reduce((sum, order) => sum + (order.subtotal_amount || 0), 0) || 0;

      // Calculate breakdown by referral level
      const levelBreakdown: { [key: number]: { customers: number; orders: number; revenue: number } } = {};

      attributedCustomersManual.forEach((c: any) => {
        const level = c.referral_level;
        if (!levelBreakdown[level]) {
          levelBreakdown[level] = { customers: 0, orders: 0, revenue: 0 };
        }
        levelBreakdown[level].customers++;

        const customerOrders = orders?.filter(o => o.customer_email === c.customer_email) || [];
        levelBreakdown[level].orders += customerOrders.length;
        levelBreakdown[level].revenue += customerOrders.reduce((sum, o) => sum + (o.subtotal_amount || 0), 0);
      });

      const byLevel = Object.entries(levelBreakdown)
        .map(([level, data]) => ({
          level: parseInt(level),
          customers: data.customers,
          orders: data.orders,
          revenue: data.revenue
        }))
        .sort((a, b) => a.level - b.level);

      const customersWithOrders = attributedCustomersManual.map((c: any) => {
        const customerOrders = orders?.filter(o => o.customer_email === c.customer_email) || [];
        return {
          ...c,
          order_count: customerOrders.length,
          total_revenue: customerOrders.reduce((sum, o) => sum + (o.subtotal_amount || 0), 0)
        };
      });

      return NextResponse.json({
        total_attributed_customers: attributedCustomersManual.length,
        total_attributed_orders: totalOrders,
        total_attributed_revenue: totalRevenue,
        by_level: byLevel,
        customers: customersWithOrders
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
    console.error('Error fetching customer attribution:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer attribution' },
      { status: 500 }
    );
  }
}
