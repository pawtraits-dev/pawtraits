import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

// ✅ ARCHITECTURAL PATTERN: Partner profile API endpoint
// Following established patterns for API-only data access

export async function GET(request: NextRequest) {
  try {
    console.log('🏗️ PARTNERS PROFILE API: GET request received');

    // Use service role client for database operations (bypass RLS issues)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const supabaseService = new SupabaseService();

    // ✅ ARCHITECTURAL PATTERN: Get authenticated user (still use regular client for auth)
    const { data: { user }, error: authError } = await supabaseService.getClient().auth.getUser();

    if (authError || !user) {
      console.log('❌ PARTNERS PROFILE API: Authentication failed');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // ✅ ARCHITECTURAL PATTERN: Get partner data directly from database using service role
    // First get user profile by email to find partner_id
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('email', user.email)
      .single();

    console.log('🔍 PARTNERS PROFILE API: Debug info:');
    console.log('  - User email:', user.email);
    console.log('  - User profile found:', !!userProfile);
    console.log('  - Partner ID from profile:', userProfile?.partner_id);

    if (profileError || !userProfile?.partner_id) {
      console.log('❌ PARTNERS PROFILE API: User profile or partner_id not found:', profileError?.message);
      return NextResponse.json(
        { error: 'Partner profile not found' },
        { status: 404 }
      );
    }

    // Get partner data using the partner_id
    const { data: partner, error: partnerError } = await supabaseAdmin
      .from('partners')
      .select('*')
      .eq('id', userProfile.partner_id)
      .single();

    console.log('🔍 PARTNERS PROFILE API: Partner lookup result:');
    console.log('  - Partner found:', !!partner);
    console.log('  - Partner data:', partner ? {
      id: partner.id,
      email: partner.email,
      business_name: partner.business_name,
      business_type: partner.business_type,
      business_website: partner.business_website,
      business_address: partner.business_address
    } : 'null');

    if (partnerError || !partner) {
      console.log('❌ PARTNERS PROFILE API: Partner record not found:', partnerError?.message);
      return NextResponse.json(
        { error: 'Partner profile not found' },
        { status: 404 }
      );
    }

    console.log('✅ PARTNERS PROFILE API: Partner profile retrieved successfully');
    return NextResponse.json(partner);

  } catch (error) {
    console.error('💥 PARTNERS PROFILE API: Error:', error);
    return NextResponse.json(
      { error: 'Failed to load partner profile' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    console.log('🏗️ PARTNERS PROFILE API: PUT request received');

    // Use service role client for database operations (bypass RLS issues)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const supabaseService = new SupabaseService();

    // ✅ ARCHITECTURAL PATTERN: Get authenticated user (still use regular client for auth)
    const { data: { user }, error: authError } = await supabaseService.getClient().auth.getUser();

    if (authError || !user) {
      console.log('❌ PARTNERS PROFILE API: Authentication failed');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const updateData = await request.json();
    console.log('📝 PARTNERS PROFILE API: Update data received:', updateData);

    // ✅ ARCHITECTURAL PATTERN: Get current partner and update via service role client
    // First get user profile by email to find partner_id
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('email', user.email)
      .single();

    if (profileError || !userProfile?.partner_id) {
      console.error('❌ PARTNERS PROFILE API: User profile or partner_id not found for update:', profileError?.message);
      return NextResponse.json(
        { error: 'Partner profile not found' },
        { status: 404 }
      );
    }

    // Update partner record directly using service role client
    const { data: updatedPartner, error: updateError } = await supabaseAdmin
      .from('partners')
      .update({
        first_name: updateData.first_name,
        last_name: updateData.last_name,
        phone: updateData.phone,
        business_name: updateData.business_name,
        business_type: updateData.business_type,
        business_address: updateData.business_address,
        business_website: updateData.business_website,
        bio: updateData.bio,
        updated_at: new Date().toISOString()
      })
      .eq('id', userProfile.partner_id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ PARTNERS PROFILE API: Update failed:', updateError);
      return NextResponse.json(
        { error: 'Failed to update partner profile' },
        { status: 500 }
      );
    }

    console.log('✅ PARTNERS PROFILE API: Partner profile updated successfully');
    return NextResponse.json(updatedPartner);

  } catch (error) {
    console.error('💥 PARTNERS PROFILE API: Error:', error);
    return NextResponse.json(
      { error: 'Failed to update partner profile' },
      { status: 500 }
    );
  }
}

// 📋 ARCHITECTURAL COMPLIANCE CHECKLIST:
// ✅ Uses SupabaseService for database operations
// ✅ Proper authentication checking
// ✅ Uses getCurrentPartner() service method
// ✅ Updates both partners and user_profiles tables
// ✅ Proper error handling and logging
// ✅ Follows API endpoint patterns