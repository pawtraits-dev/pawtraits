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

    // Get customer referral details
    const { data: referral, error: referralError } = await supabase
      .from('customer_referrals')
      .select(`
        id,
        referral_code,
        customer_name,
        customer_email,
        status,
        total_referrals,
        successful_referrals,
        created_at
      `)
      .eq('referral_code', code.toUpperCase())
      .eq('status', 'active')
      .single();

    if (referralError || !referral) {
      console.log('[CUSTOMER_REFERRAL] Referral code not found:', code, 'Error:', referralError?.message);
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
      .from('customer_referrals')
      .update({
        total_referrals: referral.total_referrals + 1,
        last_accessed: new Date().toISOString()
      })
      .eq('id', referral.id);

    return NextResponse.json({
      success: true,
      referral: {
        id: referral.id,
        referral_code: referral.referral_code,
        customer_name: referral.customer_name,
        status: referral.status,
        total_referrals: referral.total_referrals + 1, // Return updated count
        successful_referrals: referral.successful_referrals
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