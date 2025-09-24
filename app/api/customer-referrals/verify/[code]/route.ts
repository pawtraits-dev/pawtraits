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

    // Check if this referral access has already been recorded
    const { data: existingReferral } = await supabase
      .from('customer_referrals')
      .select('id, status, qr_scans_count')
      .eq('referral_code', code.toUpperCase())
      .single();

    // Track QR scan - increment scan count
    const currentScans = (existingReferral?.qr_scans_count || 0);
    const newScanCount = currentScans + 1;

    if (!existingReferral) {
      // Create new referral tracking record with 'accessed' status
      await supabase
        .from('customer_referrals')
        .insert({
          referrer_customer_id: customer.id,
          referral_code: code.toUpperCase(),
          status: 'accessed',
          accessed_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days from now
          qr_scans_count: 1 // First scan
        });

      console.log('[CUSTOMER_REFERRAL] New referral access recorded for code:', code);
    } else {
      // Update existing referral with new scan count
      const updateData: any = {
        qr_scans_count: newScanCount
      };

      // If status is pending, also update to accessed
      if (existingReferral.status === 'pending') {
        updateData.status = 'accessed';
        updateData.accessed_at = new Date().toISOString();
      }

      await supabase
        .from('customer_referrals')
        .update(updateData)
        .eq('referral_code', code.toUpperCase());

      console.log('[CUSTOMER_REFERRAL] Updated referral scan count to', newScanCount, 'for code:', code);
    }

    // Get actual referral stats from customer_referrals table
    const { data: referralStats } = await supabase
      .from('customer_referrals')
      .select('status')
      .eq('referrer_customer_id', customer.id);

    const totalReferrals = referralStats?.length || 0;
    const successfulReferrals = referralStats?.filter(r => ['purchased', 'credited'].includes(r.status)).length || 0;

    return NextResponse.json({
      success: true,
      referral: {
        id: customer.id,
        referral_code: customer.personal_referral_code,
        customer_name: `${customer.first_name} ${customer.last_name}`,
        customer_email: customer.email,
        status: 'active', // Customer referrals are always active
        total_referrals: totalReferrals,
        successful_referrals: successfulReferrals
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