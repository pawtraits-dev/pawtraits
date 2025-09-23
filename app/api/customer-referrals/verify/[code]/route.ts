import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { code } = params;

    if (!code) {
      return NextResponse.json({ error: 'Referral code is required' }, { status: 400 });
    }

    // Get customer with static referral code
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select(`
        id,
        first_name,
        last_name,
        email,
        personal_referral_code,
        total_referrals,
        successful_referrals,
        created_at
      `)
      .eq('personal_referral_code', code.toUpperCase())
      .single();

    if (customerError || !customer) {
      console.log('[CUSTOMER_REFERRAL] Customer referral code not found:', code, 'Error:', customerError?.message);
      return NextResponse.json(
        {
          error: 'Referral code not found or inactive',
          code: 'REFERRAL_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    // Record referral access (increment view count)
    await supabase
      .from('customers')
      .update({
        total_referrals: (customer.total_referrals || 0) + 1,
        last_shared_at: new Date().toISOString()
      })
      .eq('id', customer.id);

    return NextResponse.json({
      success: true,
      referral: {
        id: customer.id,
        referral_code: customer.personal_referral_code,
        customer_name: `${customer.first_name} ${customer.last_name}`,
        customer_email: customer.email,
        status: 'active', // Customer referrals are always active
        total_referrals: (customer.total_referrals || 0) + 1, // Return updated count
        successful_referrals: customer.successful_referrals || 0
      }
    });

  } catch (error) {
    console.error('Error verifying customer referral code:', error);
    return NextResponse.json(
      { error: 'Failed to verify referral code' },
      { status: 500 }
    );
  }
}