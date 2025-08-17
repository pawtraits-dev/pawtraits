import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Use service role key for admin operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('Customer orders API: Fetching orders for customer', id);

    // First get the customer's user_id from user_profiles
    const { data: customerProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('user_id, email')
      .eq('id', id)
      .eq('user_type', 'customer')
      .single();

    if (profileError) {
      console.error('Error fetching customer profile:', profileError);
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Query orders by customer email
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*)
      `)
      .eq('customer_email', customerProfile.email)
      .order('created_at', { ascending: false });

    if (ordersError) {
      console.error('Error fetching customer orders:', ordersError);
      return NextResponse.json([], { status: 200 });
    }

    console.log('Customer orders API: Found', orders?.length || 0, 'orders for customer', customerProfile.email);
    return NextResponse.json(orders || []);

  } catch (error) {
    console.error('Error fetching customer orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer orders' },
      { status: 500 }
    );
  }
}