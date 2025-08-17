import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;
    const { searchParams } = new URL(request.url);
    const customerEmail = searchParams.get('email');

    if (!customerEmail) {
      return NextResponse.json(
        { error: 'Customer email required' },
        { status: 400 }
      );
    }

    const supabaseService = new SupabaseService();

    // Get order with items, ensuring it belongs to the customer
    const { data: order, error: orderError } = await supabaseService.getClient()
      .from('orders')
      .select(`
        *,
        order_items (*)
      `)
      .eq('id', orderId)
      .eq('customer_email', customerEmail)
      .single();

    if (orderError || !order) {
      console.error('Order not found for customer:', orderError);
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(order);

  } catch (error) {
    console.error('Error fetching customer order details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order details' },
      { status: 500 }
    );
  }
}