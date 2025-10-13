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
    
    // Get commission data from new commissions table with order and customer info
    const { data: commissions, error: commissionsError } = await supabase
      .from('commissions')
      .select(`
        *,
        orders!inner (
          id,
          order_number,
          customer_email,
          subtotal_amount,
          total_amount,
          status,
          created_at
        )
      `)
      .eq('recipient_id', id)
      .eq('recipient_type', 'partner')
      .order('created_at', { ascending: false });

    console.log('📊 Commissions for partner:', commissions?.length || 0);

    if (commissionsError) {
      console.error('❌ Error fetching commissions:', commissionsError);
      throw commissionsError;
    }

    // Get customer IDs from commissions to look up user_profiles.id
    const customerEmails = [...new Set(commissions?.map((c: any) => c.orders?.customer_email).filter(Boolean))] as string[];

    let customerIdMap = new Map<string, string>();
    if (customerEmails.length > 0) {
      const { data: userProfiles } = await supabase
        .from('user_profiles')
        .select('id, email')
        .in('email', customerEmails)
        .eq('user_type', 'customer');

      customerIdMap = new Map((userProfiles || []).map((up: any) => [up.email, up.id]));
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

    // Use commissions data as commission records with order and customer info
    const referralCommissions = commissions?.map((commission: any) => ({
      id: commission.id,
      order_id: commission.order_id,
      order_number: commission.orders?.order_number || 'N/A',
      referral_code: commission.referral_code || 'N/A',
      client_email: commission.orders?.customer_email || 'Unknown',
      customer_id: customerIdMap.get(commission.orders?.customer_email) || null,
      order_amount: commission.order_amount,
      order_status: commission.orders?.status || 'unknown',
      status: commission.status,
      commission_amount: commission.commission_amount, // Already in cents
      commission_paid: commission.status === 'paid',
      commission_rate: commission.commission_rate,
      purchased_at: commission.orders?.created_at || commission.created_at,
      created_at: commission.created_at
    })) || [];

    // Calculate commission summary - convert from cents to pounds
    const totalEarned = commissions?.reduce((sum: number, commission: any) => sum + ((commission.commission_amount || 0) / 100), 0) || 0;
    const totalPaid = commissions?.reduce((sum: number, commission: any) => sum + (commission.status === 'paid' ? ((commission.commission_amount || 0) / 100) : 0), 0) || 0;
    const totalPending = totalEarned - totalPaid;
    const successfulReferrals = commissions?.length || 0;

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