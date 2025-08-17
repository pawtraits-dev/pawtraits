import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;
    const supabaseService = new SupabaseService();

    // Check if user is admin
    const admin = await supabaseService.getCurrentAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get order with items
    const { data: order, error: orderError } = await supabaseService.getClient()
      .from('orders')
      .select(`
        *,
        order_items (*)
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('Order not found:', orderError);
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(order);

  } catch (error) {
    console.error('Error fetching admin order details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order details' },
      { status: 500 }
    );
  }
}