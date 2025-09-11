import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;
    
    // Use service role key like main orders API for full access
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get user from authenticated session (cookie-based like main orders API)
    const { createRouteHandlerClient } = await import('@supabase/auth-helpers-nextjs');
    const { cookies } = await import('next/headers');
    const cookieStore = cookies();
    const authSupabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    const { data: { user }, error: authError } = await authSupabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authorization' },
        { status: 401 }
      );
    }

    // Get user profile and check if this user is a partner
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, user_type, partner_id')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile || userProfile.user_type !== 'partner') {
      return NextResponse.json(
        { error: 'Partner profile not found' },
        { status: 404 }
      );
    }

    // Get partner record using the correct relationship
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, email, first_name, last_name, business_name')
      .eq('id', userProfile.partner_id)
      .single();

    if (partnerError || !partner) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Get specific order placed by this partner (both partner orders and partner-for-client orders)
    // This matches the logic used in the main /api/partners/orders route
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *
        )
      `)
      .eq('id', orderId)
      .or(
        `customer_email.eq.${partner.email},placed_by_partner_id.eq.${partner.id}`
      )
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(order);

  } catch (error) {
    console.error('Error in partner order details API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order details' },
      { status: 500 }
    );
  }
}