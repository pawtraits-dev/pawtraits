import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    // Create service role client for authentication
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get authorization header
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Get user from token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authorization' },
        { status: 401 }
      );
    }

    // Get user profile to determine user type
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('user_type, partner_id, customer_id')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    // Handle based on user type
    if (userProfile.user_type === 'partner') {
      return await getPartnerReferralCode(supabase, userProfile.partner_id);
    } else if (userProfile.user_type === 'customer') {
      return await getCustomerReferralCode(supabase, userProfile.customer_id);
    } else {
      return NextResponse.json(
        { error: 'Referral codes not available for this user type' },
        { status: 403 }
      );
    }
  } catch (error) {
    console.error('Error fetching referral code:', error);
    return NextResponse.json(
      { error: 'Failed to fetch referral code' },
      { status: 500 }
    );
  }
}

async function getPartnerReferralCode(supabase: any, partnerId: string) {
  // First check for pre-registration codes (priority)
  const { data: preRegCodes, error: preRegError } = await supabase
    .from('pre_registration_codes')
    .select('code, qr_code_url, status, scans_count, conversions_count, created_at')
    .eq('partner_id', partnerId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (preRegError) {
    console.error('Error fetching pre-registration codes:', preRegError);
  }

  // Also get personal referral code
  const { data: partner, error: partnerError } = await supabase
    .from('partners')
    .select('personal_referral_code, business_name, first_name, last_name')
    .eq('id', partnerId)
    .single();

  if (partnerError) {
    console.error('Error fetching partner:', partnerError);
    return NextResponse.json(
      { error: 'Failed to fetch partner data' },
      { status: 500 }
    );
  }

  // Determine which code to return as primary
  let primaryCode = null;
  let allCodes = [];

  // Pre-registration codes take priority
  if (preRegCodes && preRegCodes.length > 0) {
    primaryCode = {
      code: preRegCodes[0].code,
      qr_code_url: preRegCodes[0].qr_code_url,
      type: 'pre_registration' as const,
      scans_count: preRegCodes[0].scans_count || 0,
      conversions_count: preRegCodes[0].conversions_count || 0,
      created_at: preRegCodes[0].created_at,
      share_url: `/p/${preRegCodes[0].code}`
    };

    // Add all pre-reg codes to the list
    allCodes = preRegCodes.map((code: any) => ({
      code: code.code,
      qr_code_url: code.qr_code_url,
      type: 'pre_registration' as const,
      scans_count: code.scans_count || 0,
      conversions_count: code.conversions_count || 0,
      share_url: `/p/${code.code}`
    }));
  }

  // If no pre-reg code, use personal referral code
  if (!primaryCode && partner.personal_referral_code) {
    primaryCode = {
      code: partner.personal_referral_code,
      qr_code_url: null, // TODO: Generate QR code if needed
      type: 'personal' as const,
      scans_count: 0,
      conversions_count: 0,
      created_at: null,
      share_url: `/p/${partner.personal_referral_code}`
    };

    allCodes.push(primaryCode);
  }

  if (!primaryCode) {
    return NextResponse.json(
      { error: 'No referral code found for this partner' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    user_type: 'partner',
    partner_name: partner.business_name || `${partner.first_name} ${partner.last_name}`,
    primary_code: primaryCode,
    all_codes: allCodes
  });
}

async function getCustomerReferralCode(supabase: any, customerId: string) {
  const { data: customer, error } = await supabase
    .from('customers')
    .select('personal_referral_code, first_name, last_name, total_referrals, successful_referrals')
    .eq('id', customerId)
    .single();

  if (error) {
    console.error('Error fetching customer:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer data' },
      { status: 500 }
    );
  }

  if (!customer.personal_referral_code) {
    return NextResponse.json(
      { error: 'No referral code found for this customer' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    user_type: 'customer',
    customer_name: `${customer.first_name} ${customer.last_name}`,
    primary_code: {
      code: customer.personal_referral_code,
      qr_code_url: null, // Customers typically don't need QR codes
      type: 'personal' as const,
      scans_count: customer.total_referrals || 0,
      conversions_count: customer.successful_referrals || 0,
      share_url: `/c/${customer.personal_referral_code}`
    },
    all_codes: [{
      code: customer.personal_referral_code,
      type: 'personal' as const,
      scans_count: customer.total_referrals || 0,
      conversions_count: customer.successful_referrals || 0,
      share_url: `/c/${customer.personal_referral_code}`
    }]
  });
}
