import { NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';

export async function GET() {
  try {
    const supabaseService = new SupabaseService();
    
    console.log('🔍 Debugging sales data...');
    
    // Check recent orders
    const { data: orders, error: ordersError } = await supabaseService.supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (ordersError) {
      console.error('Orders error:', ordersError);
    }
    
    // Check recent order items
    const { data: orderItems, error: itemsError } = await supabaseService.supabase
      .from('order_items')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (itemsError) {
      console.error('Order items error:', itemsError);
    }
    
    // Check analytics query (what the dashboard uses)
    const { data: analyticsData, error: analyticsError } = await supabaseService.supabase
      .from('order_items')
      .select('image_id, COUNT(*) as count, SUM(unit_price * quantity) as total_revenue')
      .group(['image_id']);
    
    if (analyticsError) {
      console.error('Analytics error:', analyticsError);
    }
    
    // Check order items without image_id
    const { data: noImageItems, error: noImageError } = await supabaseService.supabase
      .from('order_items')
      .select('id, order_id, product_id, unit_price, quantity, image_id')
      .is('image_id', null);
    
    const response = {
      timestamp: new Date().toISOString(),
      debug_info: {
        orders: {
          count: orders?.length || 0,
          data: orders || [],
          error: ordersError?.message
        },
        order_items: {
          count: orderItems?.length || 0,
          data: orderItems || [],
          error: itemsError?.message
        },
        analytics_query: {
          count: analyticsData?.length || 0,
          data: analyticsData || [],
          error: analyticsError?.message
        },
        items_without_image_id: {
          count: noImageItems?.length || 0,
          data: noImageItems || [],
          error: noImageError?.message
        }
      }
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Debug API error:', error);
    return NextResponse.json(
      { error: 'Debug failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}