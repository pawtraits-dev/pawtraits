import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    // Use service role key for public QR code access
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { code } = params;

    if (!code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    // Get the pre-registration code with partner information
    const { data: codeData, error } = await supabase
      .from('pre_registration_codes')
      .select(`
        *,
        partner:partners(
          id,
          business_name,
          first_name,
          last_name,
          logo_url
        )
      `)
      .eq('code', code)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Code not found' }, { status: 404 });
      }
      console.error('Failed to fetch pre-registration code:', error);
      return NextResponse.json({ error: 'Failed to verify code' }, { status: 500 });
    }

    // Check if code is active
    if (codeData.status !== 'active') {
      if (codeData.status === 'expired') {
        return NextResponse.json({ error: 'Code has expired' }, { status: 410 });
      } else if (codeData.status === 'used') {
        // If code is used, partner has signed up - now redirect customers to referral
        return await handleCustomerReferral(supabase, codeData);
      }
      return NextResponse.json({ error: 'Code is not active' }, { status: 410 });
    }

    // Check if code has expired
    if (codeData.expiration_date && new Date(codeData.expiration_date) < new Date()) {
      return NextResponse.json({ error: 'Code has expired' }, { status: 410 });
    }

    // Increment scan count
    await supabase
      .from('pre_registration_codes')
      .update({
        scans_count: codeData.scans_count + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', codeData.id);

    return NextResponse.json(codeData);
  } catch (error) {
    console.error('Pre-registration code verification error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleCustomerReferral(supabase: any, codeData: any) {
  try {
    // Check if partner has actually completed signup and is approved
    if (!codeData.partner_id) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    // Get partner details to verify they exist and are approved
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, business_name, first_name, last_name, status, logo_url')
      .eq('id', codeData.partner_id)
      .single();

    if (partnerError || !partner) {
      console.error('Partner not found:', partnerError);
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    // Only allow referrals for approved partners
    if (partner.status !== 'approved') {
      return NextResponse.json({ error: 'Partner not yet approved' }, { status: 403 });
    }

    // Check if we already have a referral for this pre-registration code
    let { data: existingReferral } = await supabase
      .from('referrals')
      .select('referral_code')
      .eq('pre_registration_code_id', codeData.id)
      .single();

    let referralCode;

    if (existingReferral) {
      // Use existing referral
      referralCode = existingReferral.referral_code;
    } else {
      // Create new referral for this partner using the pre-registration code
      referralCode = `P${codeData.code}`;

      // Create referral record
      const { error: referralError } = await supabase
        .from('referrals')
        .insert({
          referral_code: referralCode,
          partner_id: codeData.partner_id,
          pre_registration_code_id: codeData.id,
          client_first_name: 'QR Code',
          client_last_name: 'Customer',
          commission_rate: 10.0, // Standard 10% commission
          status: 'active',
          referral_type: 'traditional', // QR code referrals are traditional type
          expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() // 90 days
        });

      if (referralError) {
        console.error('Failed to create referral:', referralError);
        // If referral already exists with this code, that's fine
        if (!referralError.message?.includes('duplicate') && !referralError.message?.includes('unique')) {
          return NextResponse.json({ error: 'Failed to create referral' }, { status: 500 });
        }
      }
    }

    console.log(`🎯 QR Code ${codeData.code}: Redirecting customer to referral ${referralCode}`);

    // Return referral redirect info
    return NextResponse.json({
      redirect: 'customer_referral',
      referral_code: referralCode,
      partner: {
        id: partner.id,
        business_name: partner.business_name,
        first_name: partner.first_name,
        last_name: partner.last_name,
        logo_url: partner.logo_url
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error handling customer referral:', error);
    return NextResponse.json({ error: 'Failed to process referral' }, { status: 500 });
  }
}