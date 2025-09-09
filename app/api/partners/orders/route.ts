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

    // Return the raw orders data in the same format as customer/admin APIs
    // This allows the common ProductDescriptionService to work properly
    return NextResponse.json(partnerOrders || []);

  } catch (error) {
    console.error('Error in partner orders API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch partner orders' },
      { status: 500 }
    );
  }
}