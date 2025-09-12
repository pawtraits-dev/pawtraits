import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    // Get authorization header  
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No auth header found for commissions');
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get user from token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: 'Invalid authorization' },
        { status: 401 }
      );
    }

    const partnerId = user.id; // Partner ID is the user ID

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'paid' or 'unpaid'

    console.log('Partner commissions API: Fetching commission data for partner:', partnerId);

    // Get commission data
    let query = supabase
      .from('client_orders')
      .select(`
        *,
        referrals (
          referral_code,
          client_name,
          client_email
        )
      `)
      .eq('partner_id', partnerId);

    if (status === 'paid') {
      query = query.eq('commission_paid', true);
    } else if (status === 'unpaid') {
      query = query.eq('commission_paid', false);
    }

    const { data: orders, error } = await query
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching commission orders:', error);
      throw error;
    }

    // Calculate totals (convert from pennies to pounds)
    const unpaidCommissions = orders?.filter(o => !o.commission_paid) || [];
    const paidCommissions = orders?.filter(o => o.commission_paid) || [];
    
    const unpaidTotal = unpaidCommissions.reduce((sum, order) => 
      sum + ((parseFloat(order.commission_amount) || 0) / 100), 0
    );
    
    const paidTotal = paidCommissions.reduce((sum, order) => 
      sum + ((parseFloat(order.commission_amount) || 0) / 100), 0
    );

    const totalCommissions = unpaidTotal + paidTotal;

    // Separate by commission type
    const initialOrders = orders?.filter(o => o.is_initial_order) || [];
    const subsequentOrders = orders?.filter(o => !o.is_initial_order) || [];

    const response = {
      summary: {
        totalCommissions: totalCommissions.toFixed(2),
        unpaidTotal: unpaidTotal.toFixed(2),
        paidTotal: paidTotal.toFixed(2),
        unpaidCount: unpaidCommissions.length,
        paidCount: paidCommissions.length,
        initialOrdersCount: initialOrders.length,
        subsequentOrdersCount: subsequentOrders.length
      },
      orders: orders || [],
      unpaidCommissions,
      paidCommissions
    };

    console.log('Partner commissions API: Found', orders?.length || 0, 'commission orders for partner', partnerId);
    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching partner commission data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch commission data' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Get authorization header  
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get user from token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authorization' },
        { status: 401 }
      );
    }

    const partnerId = user.id; // Partner ID is the user ID

    const { orderIds, action } = await request.json();

    if (!orderIds || !Array.isArray(orderIds)) {
      return NextResponse.json(
        { error: 'Order IDs array is required' },
        { status: 400 }
      );
    }

    if (action === 'markPaid') {
      // Verify all orders belong to this partner before updating
      const { data: existingOrders, error: verifyError } = await supabase
        .from('client_orders')
        .select('id')
        .eq('partner_id', partnerId)
        .in('id', orderIds);

      if (verifyError || !existingOrders || existingOrders.length !== orderIds.length) {
        return NextResponse.json(
          { error: 'Invalid order IDs or unauthorized' },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from('client_orders')
        .update({ 
          commission_paid: true,
          updated_at: new Date().toISOString()
        })
        .in('id', orderIds);

      if (error) {
        throw error;
      }

      return NextResponse.json({ 
        success: true, 
        message: `Marked ${orderIds.length} commissions as paid` 
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error updating commissions:', error);
    return NextResponse.json(
      { error: 'Failed to update commissions' },
      { status: 500 }
    );
  }
}