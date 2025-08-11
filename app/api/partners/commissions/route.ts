import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get('partnerId');
    const status = searchParams.get('status'); // 'paid' or 'unpaid'

    if (!partnerId) {
      return NextResponse.json(
        { error: 'Partner ID is required' },
        { status: 400 }
      );
    }

    // Get commission summary
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
      throw error;
    }

    // Calculate totals
    const unpaidCommissions = orders?.filter(o => !o.commission_paid) || [];
    const paidCommissions = orders?.filter(o => o.commission_paid) || [];
    
    const unpaidTotal = unpaidCommissions.reduce((sum, order) => 
      sum + (parseFloat(order.commission_amount) || 0), 0
    );
    
    const paidTotal = paidCommissions.reduce((sum, order) => 
      sum + (parseFloat(order.commission_amount) || 0), 0
    );

    const totalCommissions = unpaidTotal + paidTotal;

    // Separate by commission type
    const initialOrders = orders?.filter(o => o.is_initial_order) || [];
    const subsequentOrders = orders?.filter(o => !o.is_initial_order) || [];

    return NextResponse.json({
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
    });

  } catch (error) {
    console.error('Error fetching partner commissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch commissions' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { orderIds, action } = await request.json();

    if (!orderIds || !Array.isArray(orderIds)) {
      return NextResponse.json(
        { error: 'Order IDs array is required' },
        { status: 400 }
      );
    }

    if (action === 'markPaid') {
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