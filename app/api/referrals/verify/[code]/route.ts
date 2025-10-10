import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Unified referral verification endpoint
// Handles ALL referral types: pre-registration codes, partner referrals, customer referrals, influencer codes
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    // Use service role key for public referral code access
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { code } = await params;
    const referralCode = code.toUpperCase();

    console.log('🔍 Unified referral verification for code:', referralCode);

    // Try different referral types in priority order
    let referralData = null;
    let referralType = null;
    let referrerInfo = null;

    // 1. Check pre-registration codes (partner acquisition QR codes)
    if (!referralData) {
      const { data, error } = await supabase
        .from('pre_registration_codes')
        .select(`
          *,
          partner:partners(
            id,
            business_name,
            first_name,
            last_name,
            logo_url,
            avatar_url,
            user_profiles!inner(id)
          )
        `)
        .eq('code', referralCode)
        .eq('status', 'used') // Only used codes for customer invitations
        .single();

      if (!error && data && data.partner) {
        referralData = {
          id: data.id,
          code: data.code,
          type: 'pre_registration',
          status: 'active',
          expires_at: data.expiration_date || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          commission_rate: 10.0, // Standard partner commission
          discount_rate: 10.0,   // Standard customer discount
        };
        referralType = 'PARTNER';
        referrerInfo = {
          id: data.partner.user_profiles?.[0]?.id, // Link to user_profiles (first element of array)
          type: 'partner',
          name: data.partner.business_name || `${data.partner.first_name} ${data.partner.last_name}`,
          avatar_url: data.partner.logo_url || data.partner.avatar_url,
          business_name: data.partner.business_name,
        };
        console.log('✅ Found pre-registration code');
      }
    }

    // 2. Check partner referrals table
    if (!referralData) {
      const { data, error } = await supabase
        .from('referrals')
        .select(`
          *,
          partners(
            id,
            business_name,
            first_name,
            last_name,
            logo_url,
            avatar_url,
            user_profiles!inner(id)
          )
        `)
        .eq('referral_code', referralCode)
        .eq('status', 'accepted')
        .single();

      if (!error && data && data.partners) {
        referralData = {
          id: data.id,
          code: data.referral_code,
          type: 'partner_referral',
          status: 'active',
          expires_at: data.expires_at,
          commission_rate: data.commission_rate || 10.0,
          discount_rate: 10.0,
        };
        referralType = 'PARTNER';
        referrerInfo = {
          id: data.partners.user_profiles?.[0]?.id || data.partners.user_profiles?.id,
          type: 'partner',
          name: data.partners.business_name || `${data.partners.first_name} ${data.partners.last_name}`,
          avatar_url: data.partners.logo_url || data.partners.avatar_url,
          business_name: data.partners.business_name,
        };
        console.log('✅ Found partner referral');
      }
    }

    // 3. Check customer referrals
    if (!referralData) {
      const { data, error } = await supabase
        .from('customer_referrals')
        .select(`
          *,
          customers!referrer_customer_id(
            id,
            first_name,
            last_name,
            email,
            user_profiles!inner(id)
          )
        `)
        .eq('referral_code', referralCode)
        .eq('status', 'signed_up')
        .single();

      if (!error && data && data.customers) {
        referralData = {
          id: data.id,
          code: data.referral_code,
          type: 'customer_referral',
          status: 'active',
          expires_at: data.expires_at,
          commission_rate: 0, // Customers get credits, not commissions
          discount_rate: data.discount_amount ? (data.discount_amount / 100) : 10.0, // Convert pence to percentage
        };
        referralType = 'CUSTOMER';
        referrerInfo = {
          id: data.customers.id, // ALWAYS use customer.id for customer referrals (for attribution chain tracking)
          type: 'customer',
          name: `${data.customers.first_name} ${data.customers.last_name}`,
          avatar_url: null,
          email: data.customers.email,
        };
        console.log('✅ Found customer referral');
      }
    }

    // 4. Check influencer referrals
    if (!referralData) {
      const { data, error } = await supabase
        .from('influencer_referral_codes')
        .select(`
          *,
          influencers(
            id,
            username,
            first_name,
            last_name,
            avatar_url,
            commission_rate,
            is_verified,
            user_profiles!inner(id)
          )
        `)
        .eq('code', referralCode)
        .eq('is_active', true)
        .single();

      if (!error && data && data.influencers) {
        referralData = {
          id: data.id,
          code: data.code,
          type: 'influencer_referral',
          status: 'active',
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
          commission_rate: data.influencers.commission_rate || 10.0,
          discount_rate: 10.0,
        };
        referralType = 'INFLUENCER';
        referrerInfo = {
          id: data.influencers.user_profiles?.[0]?.id || data.influencers.user_profiles?.id,
          type: 'influencer',
          name: `@${data.influencers.username}${data.influencers.is_verified ? ' ✓' : ''}`,
          avatar_url: data.influencers.avatar_url,
          username: data.influencers.username,
          is_verified: data.influencers.is_verified,
        };
        console.log('✅ Found influencer referral');
      }
    }

    // 5. Check partner personal referral codes (for referring customers)
    if (!referralData) {
      const { data, error } = await supabase
        .from('partners')
        .select('id, first_name, last_name, email, business_name, personal_referral_code, logo_url, avatar_url, is_active')
        .eq('personal_referral_code', referralCode)
        .eq('is_active', true)
        .single();

      if (!error && data) {
        // Get user_profile separately
        const { data: userProfileData } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('email', data.email)
          .maybeSingle();

        referralData = {
          id: data.id,
          code: data.personal_referral_code,
          type: 'partner_personal_code',
          status: 'active',
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
          commission_rate: 10.0, // Partners earn commissions
          discount_rate: 10.0, // 10% discount for referred customers
        };
        referralType = 'PARTNER';
        referrerInfo = {
          id: userProfileData?.id || data.id, // Use user_profile id if exists, otherwise partner id
          type: 'partner',
          name: data.business_name || `${data.first_name} ${data.last_name}`,
          avatar_url: data.logo_url || data.avatar_url,
          business_name: data.business_name,
        };
        console.log('✅ Found partner personal referral code');
      }
    }

    // 6. Check customer personal referral codes (new system)
    if (!referralData) {
      const { data, error } = await supabase
        .from('customers')
        .select('id, first_name, last_name, email, personal_referral_code, is_registered')
        .eq('personal_referral_code', referralCode)
        .eq('is_registered', true)
        .single();

      if (!error && data) {
        // Get user_profile separately (may not exist for all customers)
        const { data: userProfileData } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('email', data.email)
          .maybeSingle();

        referralData = {
          id: data.id,
          code: data.personal_referral_code,
          type: 'customer_personal_code',
          status: 'active',
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
          commission_rate: 0, // Customers get credits, not commissions
          discount_rate: 10.0, // 10% discount for referred customers
        };
        referralType = 'CUSTOMER';
        referrerInfo = {
          id: data.id, // ALWAYS use customer.id for customer referrals (for attribution chain tracking)
          type: 'customer',
          name: `${data.first_name} ${data.last_name}`,
          avatar_url: null,
          email: data.email,
        };
        console.log('✅ Found customer personal referral code');
      }
    }

    // If no referral found
    if (!referralData) {
      console.log('❌ No referral found for code:', referralCode);
      return NextResponse.json(
        { error: 'Referral code not found or not active' },
        { status: 404 }
      );
    }

    // Check expiration
    if (referralData.expires_at && new Date(referralData.expires_at) < new Date()) {
      console.log('⏰ Referral expired:', referralCode);
      return NextResponse.json(
        { error: 'Referral code has expired' },
        { status: 410 }
      );
    }

    // Build unified response
    const response = {
      id: referralData.id,
      code: referralData.code,
      type: referralData.type,
      status: referralData.status,
      expires_at: referralData.expires_at,
      commission_rate: referralData.commission_rate,
      discount_rate: referralData.discount_rate,
      referral_type: referralType, // For new simplified system
      referrer: referrerInfo,
      // Legacy compatibility fields
      partner: referrerInfo.type === 'partner' ? {
        id: referrerInfo.id,
        first_name: referrerInfo.name.split(' ')[0],
        last_name: referrerInfo.name.split(' ').slice(1).join(' '),
        business_name: referrerInfo.business_name,
        logo_url: referrerInfo.avatar_url,
        avatar_url: referrerInfo.avatar_url,
      } : null
    };

    console.log('✅ Unified referral verification successful:', {
      code: referralCode,
      type: referralType,
      referrer: referrerInfo.name
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error('💥 Unified referral verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify referral code' },
      { status: 500 }
    );
  }
}

// Record referral usage when customer signs up
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { code } = await params;
    const body = await request.json();
    const { customer_id, customer_email } = body;

    console.log('📝 Recording referral usage:', { code, customer_id, customer_email });

    // First verify the referral exists (using GET logic)
    const verifyResponse = await fetch(`${request.nextUrl.origin}/api/referrals/verify/${code}`);
    if (!verifyResponse.ok) {
      return NextResponse.json(
        { error: 'Invalid referral code' },
        { status: 400 }
      );
    }

    const referralData = await verifyResponse.json();

    // Update customer record with referral information
    const { error: updateError } = await supabase
      .from('customers')
      .update({
        referral_type: referralData.referral_type,
        referrer_id: referralData.referrer.id,
        referral_code_used: code.toUpperCase(),
        referral_discount_applied: Math.round(referralData.discount_rate * 100), // Store in pence
        referral_commission_rate: referralData.commission_rate,
        referral_applied_at: new Date().toISOString()
      })
      .eq('id', customer_id);

    if (updateError) {
      console.error('❌ Failed to update customer referral data:', updateError);
      return NextResponse.json(
        { error: 'Failed to record referral usage' },
        { status: 500 }
      );
    }

    console.log('✅ Referral usage recorded successfully');
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('💥 Error recording referral usage:', error);
    return NextResponse.json(
      { error: 'Failed to record referral usage' },
      { status: 500 }
    );
  }
}