import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerEmail = searchParams.get('email');

    if (!customerEmail) {
      return NextResponse.json(
        { error: 'Customer email required' },
        { status: 400 }
      );
    }

    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    console.log('Customer redemptions API: Fetching data for customer:', customerEmail);

    // Get customer record
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, email')
      .eq('email', customerEmail)
      .single();

    if (customerError || !customer) {
      console.error('Error fetching customer:', customerError);
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    const customerId = customer.id;

    // Get orders where customer used credits (credit_applied > 0)
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, order_number, customer_email, total_amount, credit_applied, created_at')
      .eq('customer_email', customerEmail)
      .gt('credit_applied', 0)
      .order('created_at', { ascending: false });

    if (ordersError) {
      console.error('Error fetching orders with credits:', ordersError);
      return NextResponse.json(
        { error: 'Failed to fetch redemption data' },
        { status: 500 }
      );
    }

    // Transform orders into redemption records
    const redemptions = orders ? orders.map(order => ({
      id: order.id,
      customer_id: customerId,
      order_id: order.id,
      order_number: order.order_number,
      credits_used: (order.credit_applied || 0) / 100, // Convert pence to pounds
      order_total: (order.total_amount || 0) / 100, // Convert pence to pounds
      redeemed_at: order.created_at
    })) : [];

    console.log('Customer redemptions API: Found', redemptions.length, 'redemptions');

    return NextResponse.json({
      redemptions
    });

  } catch (error) {
    console.error('Error fetching customer redemptions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch redemption data' },
      { status: 500 }
    );
  }
}
