import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';

const supabaseService = new SupabaseService();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // TODO: Add admin authentication check
    const { id } = await params;
    
    console.log('Admin commissions API: Fetching commission data for partner:', id);
    
    // Get commission payments for the specified partner
    const { data: rawCommissionPayments, error: paymentsError } = await supabaseService['supabase']
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

    // Get detailed referral commission data
    const { data: referralCommissions, error: referralError } = await supabaseService['supabase']
      .from('referrals')
      .select(`
        id,
        referral_code,
        client_name,
        client_email,
        status,
        commission_amount,
        commission_paid,
        commission_rate,
        lifetime_commission_rate,
        purchased_at,
        created_at
      `)
      .eq('partner_id', id)
      .order('created_at', { ascending: false });

    if (referralError) {
      console.error('Error fetching referral commissions:', referralError);
      throw referralError;
    }

    // Calculate commission summary - convert from pence to pounds
    const totalEarned = referralCommissions?.reduce((sum: number, ref: any) => sum + ((ref.commission_amount || 0) / 100), 0) || 0;
    const totalPaid = referralCommissions?.reduce((sum: number, ref: any) => sum + (ref.commission_paid ? ((ref.commission_amount || 0) / 100) : 0), 0) || 0;
    const totalPending = totalEarned - totalPaid;
    const successfulReferrals = referralCommissions?.filter((ref: any) => ref.status === 'purchased').length || 0;

    // Convert referral commission amounts from pence to pounds for display
    const convertedReferralCommissions = referralCommissions?.map((ref: any) => ({
      ...ref,
      commission_amount: ref.commission_amount ? ref.commission_amount / 100 : ref.commission_amount
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

    console.log('Admin commissions API: Found', commissionPayments?.length || 0, 'payments and', referralCommissions?.length || 0, 'referral commissions for partner', id);
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching partner commission data for admin:', error);
    return NextResponse.json(
      { error: 'Failed to fetch commission data' },
      { status: 500 }
    );
  }
}