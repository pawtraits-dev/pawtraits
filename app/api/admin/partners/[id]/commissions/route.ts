import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // TODO: Add admin authentication check
    const { id } = await params;
    
    console.log('🔍 Admin partner commissions API: Fetching commission data for partner:', id);
    
    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    // Get commission data from client_orders table (actual commission records)
    const { data: clientOrders, error: ordersError } = await supabase
      .from('client_orders')
      .select('*')
      .eq('partner_id', id)
      .order('created_at', { ascending: false });

    console.log('📊 Client orders for partner:', clientOrders?.length || 0);
    
    if (ordersError) {
      console.error('❌ Error fetching client orders:', ordersError);
      throw ordersError;
    }
    
    // Get commission payments for the specified partner (legacy table)
    const { data: rawCommissionPayments, error: paymentsError } = await supabase
      .from('commission_payments')
      .select('*')
      .eq('partner_id', id)
      .order('created_at', { ascending: false });

    // Convert payment amounts from pence to pounds
    const commissionPayments = rawCommissionPayments?.map((payment: any) => ({
      ...payment,
      total_amount: payment.total_amount / 100,
      initial_commission_amount: (payment.initial_commission_amount || 0) / 100,
      lifetime_commission_amount: (payment.lifetime_commission_amount || 0) / 100
    }));

    if (paymentsError) {
      console.error('Error fetching commission payments:', paymentsError);
      throw paymentsError;
    }

    // Use client_orders data as commission data (the actual commission records)
    const referralCommissions = clientOrders?.map((order: any) => ({
      id: order.id,
      referral_code: order.order_id, // Use order ID as referral code
      client_name: order.client_name || 'Unknown',
      client_email: order.client_email || '',
      status: order.order_status,
      commission_amount: order.commission_amount, // Already in pennies
      commission_paid: order.commission_paid,
      commission_rate: order.commission_rate,
      purchased_at: order.created_at,
      created_at: order.created_at
    })) || [];

    // Calculate commission summary - convert from pennies to pounds
    const totalEarned = clientOrders?.reduce((sum: number, order: any) => sum + ((order.commission_amount || 0) / 100), 0) || 0;
    const totalPaid = clientOrders?.reduce((sum: number, order: any) => sum + (order.commission_paid ? ((order.commission_amount || 0) / 100) : 0), 0) || 0;
    const totalPending = totalEarned - totalPaid;
    const successfulReferrals = clientOrders?.filter((order: any) => order.order_status === 'completed').length || 0;

    // Convert referral commission amounts from pennies to pounds for display
    const convertedReferralCommissions = referralCommissions.map((ref: any) => ({
      ...ref,
      commission_amount: ref.commission_amount ? ref.commission_amount / 100 : 0
    }));

    const response = {
      summary: {
        totalEarned,
        totalPaid,
        totalPending,
        successfulReferrals,
        averageCommission: successfulReferrals > 0 ? totalEarned / successfulReferrals : 0
      },
      payments: commissionPayments || [],
      referralCommissions: convertedReferralCommissions || []
    };

    console.log('✅ Admin partner commissions API: Found', commissionPayments?.length || 0, 'payments and', convertedReferralCommissions?.length || 0, 'commission orders for partner', id);
    console.log('📤 Commission summary:', response.summary);
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching partner commission data for admin:', error);
    return NextResponse.json(
      { error: 'Failed to fetch commission data' },
      { status: 500 }
    );
  }
}