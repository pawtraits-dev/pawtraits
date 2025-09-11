import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    // Use service role key like admin/shop APIs for full access
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get user from authenticated session (cookie-based like shop orders API)
    const { createRouteHandlerClient } = await import('@supabase/auth-helpers-nextjs');
    const { cookies } = await import('next/headers');
    const cookieStore = cookies();
    const authSupabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    const { data: { user }, error: authError } = await authSupabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if this user is a partner using service role client (no RLS restrictions)
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

    // Get orders placed by this partner using the database function
    // This includes orders placed by the partner for themselves AND for clients
    const { data: partnerOrdersResult, error: partnerOrdersError } = await supabase
      .rpc('get_partner_orders', { p_partner_email: partner.email });

    if (partnerOrdersError) {
      console.error('Error calling get_partner_orders:', partnerOrdersError);
      return NextResponse.json(
        { error: 'Failed to fetch partner orders' },
        { status: 500 }
      );
    }

    console.log('Partner orders API: Found partner orders:', partnerOrdersResult?.length || 0);

    // Get full order details with order_items for each order
    const partnerOrders = [];
    if (partnerOrdersResult && partnerOrdersResult.length > 0) {
      for (const orderResult of partnerOrdersResult) {
        const { data: fullOrder, error: orderError } = await supabase
          .from('orders')
          .select(`
            *,
            order_items (
              *
            )
          `)
          .eq('id', orderResult.id)
          .single();

        if (!orderError && fullOrder) {
          partnerOrders.push(fullOrder);
        } else {
          console.error('Error fetching full order details for partner order:', orderResult.id, orderError);
        }
      }
    }

    console.log('Partner orders API: Final orders with items:', partnerOrders.length);
    if (partnerOrders.length > 0) {
      console.log('Partner orders API: Order types:', partnerOrders.map(o => ({
        id: o.id.substring(0, 8),
        type: o.order_type,
        customer_email: o.customer_email,
        client_email: o.client_email,
        placed_by_partner: !!o.placed_by_partner_id
      })));
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