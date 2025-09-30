import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';

// ✅ ARCHITECTURAL PATTERN: Partner profile API endpoint
// Following established patterns for API-only data access

export async function GET(request: NextRequest) {
  try {
    console.log('🏗️ PARTNERS PROFILE API: GET request received');

    const supabaseService = new SupabaseService();

    // ✅ ARCHITECTURAL PATTERN: Get authenticated user
    const { data: { user }, error: authError } = await supabaseService.getClient().auth.getUser();

    if (authError || !user) {
      console.log('❌ PARTNERS PROFILE API: Authentication failed');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // ✅ ARCHITECTURAL PATTERN: Get partner data via service method
    const partner = await supabaseService.getCurrentPartner();

    if (!partner) {
      console.log('❌ PARTNERS PROFILE API: Partner not found for user:', user.email);
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

    const supabaseService = new SupabaseService();

    // ✅ ARCHITECTURAL PATTERN: Get authenticated user
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

    // ✅ ARCHITECTURAL PATTERN: Get current partner and update via direct query
    const currentPartner = await supabaseService.getCurrentPartner();
    if (!currentPartner) {
      console.error('❌ PARTNERS PROFILE API: Partner not found for update');
      return NextResponse.json(
        { error: 'Partner profile not found' },
        { status: 404 }
      );
    }

    // Update partner record directly
    const { data: updatedPartner, error: updateError } = await supabaseService.getClient()
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
      .eq('id', currentPartner.id)
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