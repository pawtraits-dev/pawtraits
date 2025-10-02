import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No auth header found for partner payments');
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

    // Get partner ID via user_profiles table
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('partner_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !userProfile?.partner_id) {
      console.error('Failed to find partner profile:', profileError);
      return NextResponse.json(
        { error: 'Partner profile not found' },
        { status: 404 }
      );
    }

    const partnerId = userProfile.partner_id;
    console.log('Partner payments API: Fetching payment data for partner:', partnerId);

    // Get payment history from commission_payments table
    const { data: payments, error: paymentsError } = await supabase
      .from('commission_payments')
      .select(`
        id,
        payment_period_start,
        payment_period_end,
        total_amount,
        referral_count,
        initial_commission_amount,
        lifetime_commission_amount,
        status,
        payment_method,
        paid_at,
        created_at,
        updated_at
      `)
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false });

    if (paymentsError) {
      console.error('Error fetching payment records:', paymentsError);
      throw paymentsError;
    }

    // Get commission count for each payment by checking linked commissions
    const enrichedPayments = await Promise.all((payments || []).map(async (payment) => {
      // Get count of commissions linked to this payment
      const { data: linkedCommissions, error: commissionError } = await supabase
        .from('commissions')
        .select('id, commission_amount')
        .eq('commission_payment_id', payment.id)
        .eq('recipient_id', user.id)
        .eq('recipient_type', 'partner');

      if (commissionError) {
        console.warn('Error fetching linked commissions for payment:', payment.id, commissionError);
      }

      const commissionCount = linkedCommissions?.length || payment.referral_count || 0;
      const totalCommissionAmount = linkedCommissions?.reduce((sum, c) => sum + (c.commission_amount || 0), 0) || (payment.total_amount * 100);

      return {
        ...payment,
        commission_count: commissionCount,
        // Convert amounts from decimal to cents if needed, then back to pounds for display
        total_amount_pounds: typeof payment.total_amount === 'number'
          ? payment.total_amount
          : parseFloat(payment.total_amount || '0'),
        initial_amount_pounds: typeof payment.initial_commission_amount === 'number'
          ? payment.initial_commission_amount
          : parseFloat(payment.initial_commission_amount || '0'),
        lifetime_amount_pounds: typeof payment.lifetime_commission_amount === 'number'
          ? payment.lifetime_commission_amount
          : parseFloat(payment.lifetime_commission_amount || '0'),
        linked_commissions_total: totalCommissionAmount / 100 // Convert cents to pounds
      };
    }));

    // Calculate summary statistics
    const totalPayments = enrichedPayments.length;
    const totalPaidAmount = enrichedPayments
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + p.total_amount_pounds, 0);
    const totalPendingAmount = enrichedPayments
      .filter(p => p.status !== 'paid')
      .reduce((sum, p) => sum + p.total_amount_pounds, 0);

    const summary = {
      total_payments: totalPayments,
      total_paid_amount: totalPaidAmount.toFixed(2),
      total_pending_amount: totalPendingAmount.toFixed(2),
      paid_payments_count: enrichedPayments.filter(p => p.status === 'paid').length,
      pending_payments_count: enrichedPayments.filter(p => p.status !== 'paid').length
    };

    const response = {
      summary,
      payments: enrichedPayments
    };

    console.log('Partner payments API: Found', payments?.length || 0, 'payment records for partner', partnerId);
    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching partner payment data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment data' },
      { status: 500 }
    );
  }
}