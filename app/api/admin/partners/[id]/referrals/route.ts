import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // TODO: Add admin authentication check
    const { id } = await params;

    // Use service role client for admin access
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get partner's personal referral code
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('personal_referral_code, email')
      .eq('id', id)
      .single();

    if (partnerError || !partner || !partner.personal_referral_code) {
      console.log('Admin referrals API: Partner not found or no referral code:', id);
      return NextResponse.json([]);
    }

    // Get customers who used this partner's referral code
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select(`
        id,
        email,
        first_name,
        last_name,
        referral_code_used,
        referral_type,
        referral_discount_applied,
        referral_applied_at,
        created_at
      `)
      .eq('referral_type', 'PARTNER')
      .eq('referral_code_used', partner.personal_referral_code)
      .order('created_at', { ascending: false });

    if (customersError) {
      console.error('Admin referrals API: Error fetching customers:', customersError);
      return NextResponse.json([]);
    }

    // Get commissions for these referrals
    const customerEmails = customers?.map(c => c.email) || [];
    const { data: commissions } = await supabase
      .from('commissions')
      .select('*')
      .eq('partner_id', id)
      .in('customer_email', customerEmails);

    // Map customers to referral format
    const referrals = customers?.map(customer => {
      const commission = commissions?.find(c => c.customer_email === customer.email);

      return {
        id: customer.id,
        referral_code: customer.referral_code_used,
        client_name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'N/A',
        client_email: customer.email,
        status: commission ? 'purchased' : 'accepted',
        commission_rate: commission?.commission_rate || 0,
        commission_amount: commission?.commission_amount || 0,
        commission_paid: commission?.status === 'paid',
        created_at: customer.referral_applied_at || customer.created_at,
        purchased_at: commission?.created_at || null,
        order_total: commission?.order_total || null,
        order_number: commission?.order_id || null,
        discount_applied: customer.referral_discount_applied || 0
      };
    }) || [];

    console.log('Admin referrals API: Found', referrals.length, 'referrals for partner', id);
    return NextResponse.json(referrals);
  } catch (error) {
    console.error('Error fetching partner referrals for admin:', error);
    return NextResponse.json(
      { error: 'Failed to fetch partner referrals' },
      { status: 500 }
    );
  }
}