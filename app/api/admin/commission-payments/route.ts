import { NextRequest, NextResponse } from 'next/server';
import { AdminSupabaseService } from '@/lib/admin-supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('📥 API: Fetching commission payment records...');

    const adminService = new AdminSupabaseService();

    // Fetch payment records with partner information
    const { data: payments, error } = await adminService.getClient()
      .from('commission_payments')
      .select(`
        *,
        partners (
          business_name,
          first_name,
          last_name,
          email
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ API: Error fetching payment records:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return NextResponse.json(
        { error: 'Failed to fetch payment records', details: error.message },
        { status: 500 }
      );
    }

    console.log(`✅ API: Found ${payments?.length || 0} payment records`);
    if (payments && payments.length > 0) {
      console.log('Sample payment record:', JSON.stringify(payments[0], null, 2));
    }

    // Transform the data to include partner details
    const transformedPayments = payments?.map((payment: any) => {
      const partnerName = payment.partners?.business_name ||
                         `${payment.partners?.first_name || ''} ${payment.partners?.last_name || ''}`.trim() ||
                         'Unknown Partner';

      return {
        id: payment.id,
        partner_id: payment.partner_id,
        partner_name: partnerName,
        partner_email: payment.partners?.email || '',
        payment_period_start: payment.payment_period_start,
        payment_period_end: payment.payment_period_end,
        total_amount: payment.total_amount,
        referral_count: payment.referral_count,
        initial_commission_amount: payment.initial_commission_amount || 0,
        lifetime_commission_amount: payment.lifetime_commission_amount || 0,
        status: payment.status,
        payment_method: payment.payment_method,
        payment_details: payment.payment_details,
        failure_reason: payment.failure_reason,
        paid_at: payment.paid_at,
        created_at: payment.created_at,
        updated_at: payment.updated_at,
      };
    }) || [];

    console.log(`✅ API: Returning ${transformedPayments.length} transformed payment records`);
    return NextResponse.json(transformedPayments);
  } catch (error) {
    console.error('❌ API: Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
