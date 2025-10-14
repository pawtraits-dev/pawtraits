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

    console.log('🔍 Admin customer credits API: Fetching credit data for customer:', id);

    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get customer basic info
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, email, first_name, last_name, current_credit_balance, created_at')
      .eq('id', id)
      .single();

    if (customerError || !customer) {
      console.error('❌ Error fetching customer:', customerError);
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Get all credits earned (from commissions table)
    const { data: earnedCredits, error: creditsError } = await supabase
      .from('commissions')
      .select(`
        id,
        order_id,
        order_amount,
        commission_amount,
        commission_rate,
        status,
        created_at,
        metadata,
        orders!inner (
          id,
          order_number,
          customer_email,
          subtotal_amount,
          total_amount,
          created_at
        )
      `)
      .eq('recipient_type', 'customer')
      .eq('recipient_id', id)
      .eq('commission_type', 'customer_credit')
      .order('created_at', { ascending: false });

    if (creditsError) {
      console.error('❌ Error fetching earned credits:', creditsError);
      return NextResponse.json(
        { error: 'Failed to fetch credits' },
        { status: 500 }
      );
    }

    console.log('💰 Found', earnedCredits?.length || 0, 'earned credit records');

    // Get redemption history (orders where customer used credits)
    const { data: redemptions, error: redemptionsError } = await supabase
      .from('orders')
      .select('id, order_number, created_at, subtotal_amount, total_amount, credit_applied')
      .eq('customer_email', customer.email)
      .gt('credit_applied', 0)
      .order('created_at', { ascending: false });

    if (redemptionsError) {
      console.warn('⚠️  Error fetching redemptions:', redemptionsError);
    }

    console.log('🎫 Found', redemptions?.length || 0, 'redemption records');

    // Calculate summary metrics
    const totalEarnedPence = earnedCredits?.reduce((sum, credit) => sum + (credit.commission_amount || 0), 0) || 0;
    const totalEarned = totalEarnedPence / 100; // Convert to pounds

    const pendingCreditsPence = earnedCredits?.filter(c => c.status === 'pending')
      .reduce((sum, credit) => sum + (credit.commission_amount || 0), 0) || 0;
    const pendingCredits = pendingCreditsPence / 100;

    const approvedCreditsPence = earnedCredits?.filter(c => c.status === 'approved' || c.status === 'paid')
      .reduce((sum, credit) => sum + (credit.commission_amount || 0), 0) || 0;
    const approvedCredits = approvedCreditsPence / 100;

    const currentBalancePence = customer.current_credit_balance || 0;
    const currentBalance = currentBalancePence / 100;

    const totalRedeemedPence = redemptions?.reduce((sum, order) => sum + (order.credit_applied || 0), 0) || 0;
    const totalRedeemed = totalRedeemedPence / 100;

    // Format earned credits for display
    const formattedEarnedCredits = earnedCredits?.map(credit => ({
      id: credit.id,
      order_id: credit.order_id,
      order_number: credit.orders?.order_number || 'N/A',
      referred_customer_email: credit.metadata?.referred_customer_email || 'Unknown',
      order_amount_pounds: (credit.order_amount || 0) / 100,
      credit_amount_pounds: (credit.commission_amount || 0) / 100,
      credit_rate: credit.commission_rate,
      status: credit.status,
      earned_date: credit.created_at,
      order_date: credit.orders?.created_at
    })) || [];

    // Format redemptions for display
    const formattedRedemptions = redemptions?.map(order => ({
      id: order.id,
      order_number: order.order_number,
      redeemed_date: order.created_at,
      order_total_pounds: (order.total_amount || 0) / 100,
      credit_used_pounds: (order.credit_applied || 0) / 100,
      amount_paid_pounds: ((order.total_amount || 0) - (order.credit_applied || 0)) / 100
    })) || [];

    const response = {
      customer: {
        id: customer.id,
        email: customer.email,
        name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.email,
        created_at: customer.created_at
      },
      summary: {
        current_balance_pounds: currentBalance,
        total_earned_pounds: totalEarned,
        pending_credits_pounds: pendingCredits,
        approved_credits_pounds: approvedCredits,
        total_redeemed_pounds: totalRedeemed,
        total_earned_credits_count: earnedCredits?.length || 0,
        total_redemptions_count: redemptions?.length || 0
      },
      earned_credits: formattedEarnedCredits,
      redemptions: formattedRedemptions
    };

    console.log('✅ Admin customer credits API: Returning data for customer', id);
    console.log('📊 Summary:', response.summary);

    return NextResponse.json(response);
  } catch (error) {
    console.error('💥 Error fetching customer credit data for admin:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credit data' },
      { status: 500 }
    );
  }
}
