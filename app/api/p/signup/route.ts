import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Generate a unique referral code
 */
function generateReferralCode(prefix: string, length: number = 6): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = prefix.toUpperCase();
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Check if a referral code is unique
 */
async function isCodeUnique(supabase: any, code: string): Promise<boolean> {
  // Check partners.personal_referral_code
  const { data: partner } = await supabase
    .from('partners')
    .select('id')
    .eq('personal_referral_code', code)
    .maybeSingle();

  if (partner) return false;

  // Check pre_registration_codes.code
  const { data: preReg } = await supabase
    .from('pre_registration_codes')
    .select('id')
    .eq('code', code)
    .maybeSingle();

  return !preReg;
}

/**
 * Generate unique code with retries
 */
async function generateUniqueCode(supabase: any, prefix: string, maxRetries: number = 10): Promise<string | null> {
  for (let i = 0; i < maxRetries; i++) {
    const code = generateReferralCode(prefix, 6);
    if (await isCodeUnique(supabase, code)) {
      return code;
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    // Use service role key for partner creation
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const body = await request.json();
    const {
      userId,
      email,
      firstName,
      lastName,
      phone,
      businessName,
      businessType,
      businessPhone,
      businessWebsite,
      businessAddress,
      preRegCode
    } = body;

    if (!userId || !email || !firstName || !lastName || !businessName || !businessType) {
      return NextResponse.json({
        error: 'Missing required fields'
      }, { status: 400 });
    }

    // Use pre-registration code if provided, otherwise generate new one
    let personalReferralCode = preRegCode;

    if (!personalReferralCode) {
      // Generate unique personal referral code for organic signups
      const codePrefix = businessName.substring(0, 3).replace(/[^A-Z0-9]/gi, '') || 'PAR';
      personalReferralCode = await generateUniqueCode(supabase, codePrefix);

      if (!personalReferralCode) {
        console.error('Failed to generate unique referral code for partner');
        return NextResponse.json({
          error: 'Failed to generate referral code'
        }, { status: 500 });
      }

      console.log(`Generated personal referral code for organic partner signup: ${personalReferralCode}`);
    } else {
      console.log(`Using pre-registration code as personal referral code: ${personalReferralCode}`);
    }

    // Create partner profile using service role
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .insert({
        id: userId,
        email: email,
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
        business_name: businessName,
        business_type: businessType,
        business_phone: businessPhone || null,
        business_website: businessWebsite || null,
        business_address: businessAddress || null,
        personal_referral_code: personalReferralCode,
        is_active: true,
        is_verified: true,  // Auto-approve
        onboarding_completed: false,
        approval_status: 'approved',
        notification_preferences: {
          email_commissions: true,
          email_referrals: true,
          sms_enabled: false
        },
        commission_rate: 0.10,
        lifetime_commission_rate: 0.10
      })
      .select()
      .single();

    if (partnerError) {
      console.error('Failed to create partner:', partnerError);
      return NextResponse.json({
        error: 'Failed to create partner profile'
      }, { status: 500 });
    }

    // Create user profile - this is critical for authentication to work
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        user_id: userId,  // Fixed: was using 'id' instead of 'user_id'
        user_type: 'partner',
        first_name: firstName,
        last_name: lastName,
        email: email,
        phone: phone || null,
        partner_id: partner.id,
        status: 'active'
      })
      .select()
      .single();

    if (profileError) {
      console.error('Failed to create user profile:', profileError);

      // Clean up the partner record if user profile creation fails
      await supabase
        .from('partners')
        .delete()
        .eq('id', userId);

      return NextResponse.json({
        error: 'Failed to create user profile - signup incomplete'
      }, { status: 500 });
    }

    console.log('✅ Created user profile for partner:', userProfile.id);

    // If a pre-registration code was used, update its status
    if (preRegCode) {
      // First get current conversions_count
      const { data: codeData } = await supabase
        .from('pre_registration_codes')
        .select('conversions_count')
        .eq('code', preRegCode)
        .single();

      const { error: updateError } = await supabase
        .from('pre_registration_codes')
        .update({
          status: 'used',
          partner_id: partner.id,
          conversions_count: (codeData?.conversions_count || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('code', preRegCode);

      if (updateError) {
        console.error('Failed to update pre-registration code status:', updateError);
        // Continue anyway - this is not critical to signup success
      } else {
        console.log(`✅ Updated pre-registration code ${preRegCode} to 'used' status`);
      }
    }

    return NextResponse.json({
      success: true,
      partner: partner
    });

  } catch (error) {
    console.error('Partner signup API error:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}