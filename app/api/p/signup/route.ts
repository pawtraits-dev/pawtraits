import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
      businessAddress
    } = body;

    if (!userId || !email || !firstName || !lastName || !businessName || !businessType) {
      return NextResponse.json({
        error: 'Missing required fields'
      }, { status: 400 });
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