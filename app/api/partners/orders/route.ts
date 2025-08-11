import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get authorization header  
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Get user from token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authorization' },
        { status: 401 }
      );
    }

    // Check if this user is a partner
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, email, first_name, last_name, business_name')
      .eq('id', user.id)
      .single();

    if (partnerError || !partner) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Get orders placed by this partner
    // We'll identify partner orders by checking if the order was placed through partner checkout
    // For now, we'll look for orders that have partner-related metadata or were placed by the partner's email
    
    // First approach: Orders placed by partner's email (when they order for clients)
    const { data: partnerOrders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *
        )
      `)
      .eq('customer_email', partner.email)
      .order('created_at', { ascending: false });

    if (ordersError) {
      console.error('Error fetching partner orders:', ordersError);
      return NextResponse.json(
        { error: 'Failed to fetch orders' },
        { status: 500 }
      );
    }

    // Transform the data to match the expected format
    const transformedOrders = (partnerOrders || []).map(order => ({
      id: order.id,
      orderNumber: order.order_number,
      date: order.created_at,
      status: order.status,
      total: order.total_amount / 100, // Convert from pence to pounds
      originalTotal: (order.total_amount + (order.discount_amount || 0)) / 100,
      partnerDiscount: (order.discount_amount || 0) / 100,
      subtotal: order.subtotal_amount / 100,
      shipping: order.shipping_amount / 100,
      currency: order.currency || 'GBP',
      estimatedDelivery: order.estimated_delivery,
      trackingNumber: order.tracking_number,
      items: (order.order_items || []).map((item: any) => ({
        id: item.id,
        imageUrl: item.image_url,
        imageTitle: item.image_title,
        title: item.image_title,
        product: `Product ID: ${item.product_id}`,
        quantity: item.quantity,
        unitPrice: item.unit_price / 100,
        totalPrice: item.total_price / 100,
        originalPrice: item.unit_price / 100, // For now, same as unit price
        price: item.unit_price / 100
      })),
      // Client info (for partners, this is usually themselves unless they specify otherwise)
      clientInfo: {
        name: `${order.shipping_first_name} ${order.shipping_last_name}`,
        email: order.customer_email
      },
      shippingAddress: {
        firstName: order.shipping_first_name,
        lastName: order.shipping_last_name,
        address: order.shipping_address,
        city: order.shipping_city,
        postcode: order.shipping_postcode,
        country: order.shipping_country
      }
    }));

    return NextResponse.json(transformedOrders);

  } catch (error) {
    console.error('Error in partner orders API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch partner orders' },
      { status: 500 }
    );
  }
}