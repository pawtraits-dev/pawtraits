import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;
    const supabaseService = new SupabaseService();

    // Check if user is a partner
    const partner = await supabaseService.getCurrentPartner();
    if (!partner) {
      return NextResponse.json(
        { error: 'Partner access required' },
        { status: 403 }
      );
    }

    // Get order with items, ensuring it's related to this partner
    const { data: order, error: orderError } = await supabaseService.getClient()
      .from('orders')
      .select(`
        *,
        order_items (*),
        referrals!inner(partner_id)
      `)
      .eq('id', orderId)
      .eq('referrals.partner_id', partner.id)
      .single();

    if (orderError || !order) {
      console.error('Order not found for partner:', orderError);
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(order);

  } catch (error) {
    console.error('Error fetching partner order details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order details' },
      { status: 500 }
    );
  }
}