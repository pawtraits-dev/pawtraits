import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    console.log('Partner order detail API: Looking for order ID:', orderId);
    
    // Use service role key like main orders API for full access
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get user from authenticated session (cookie-based like main orders API)
    const { createRouteHandlerClient } = await import('@supabase/auth-helpers-nextjs');
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const authSupabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    const { data: { user }, error: authError } = await authSupabase.auth.getUser();
    console.log('Partner order detail API: Auth check:', { 
      hasUser: !!user, 
      userId: user?.id?.substring(0, 8), 
      authError: authError?.message 
    });
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authorization' },
        { status: 401 }
      );
    }

    // Get partner record directly using user ID (simpler approach)
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, email, first_name, last_name, business_name')
      .eq('id', user.id)
      .single();

    console.log('Partner order detail API: Partner lookup:', {
      hasPartner: !!partner,
      partnerEmail: partner?.email,
      partnerError: partnerError?.message
    });

    if (partnerError || !partner) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Simple approach: Get the order by ID first, then verify it belongs to this partner
    console.log('Partner order detail API: Order lookup:', {
      orderId: orderId,
      partnerEmail: partner.email,
      partnerId: partner.id.substring(0, 8)
    });

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *
        )
      `)
      .eq('id', orderId)
      .single();

    console.log('Partner order detail API: Order found:', {
      hasOrder: !!order,
      orderType: order?.order_type,
      customerEmail: order?.customer_email,
      placedByPartnerId: order?.placed_by_partner_id?.substring(0, 8)
    });

    // Check if this order belongs to the partner (either as customer or placed by partner)
    if (order && !(
      order.customer_email === partner.email || 
      order.placed_by_partner_id === partner.id
    )) {
      console.log('Partner order detail API: Order access denied - not owned by partner');
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    if (orderError || !order) {
      console.log('Partner order detail API: Order not found:', {
        orderError: orderError?.message,
        errorCode: orderError?.code
      });
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    console.log('Partner order detail API: Order access verified - returning order');

    return NextResponse.json(order);

  } catch (error) {
    console.error('Error in partner order details API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order details' },
      { status: 500 }
    );
  }
}