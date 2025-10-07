import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get the most recent orders to see their status
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(3);

    if (ordersError) {
      return NextResponse.json({
        error: 'Failed to fetch orders',
        details: ordersError,
        timestamp: new Date().toISOString()
      });
    }

    // Check for any orders with fulfillment_error status
    const errorOrders = orders?.filter(order => order.status === 'fulfillment_error') || [];

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      total_orders: orders?.length || 0,
      recent_orders: orders?.map(order => ({
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        payment_status: order.payment_status,
        payment_intent_id: order.payment_intent_id,
        gelato_order_id: order.gelato_order_id,
        gelato_status: order.gelato_status,
        error_message: order.error_message,
        total_amount: order.total_amount,
        currency: order.currency,
        created_at: order.created_at
      })) || [],
      error_orders: errorOrders.map(order => ({
        id: order.id,
        order_number: order.order_number,
        error_message: order.error_message,
        created_at: order.created_at
      }))
    });

  } catch (error) {
    console.error('💥 Webhook logs debug error:', error);
    return NextResponse.json(
      { 
        error: 'Webhook logs debug failed', 
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}