import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';

// ✅ ARCHITECTURAL PATTERN: Partner payment settings API endpoint

export async function PUT(request: NextRequest) {
  try {
    console.log('🏗️ PARTNERS PAYMENT API: PUT request received');

    const supabaseService = new SupabaseService();

    // ✅ ARCHITECTURAL PATTERN: Get authenticated user
    const { data: { user }, error: authError } = await supabaseService.getClient().auth.getUser();

    if (authError || !user) {
      console.log('❌ PARTNERS PAYMENT API: Authentication failed');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const updateData = await request.json();
    console.log('📝 PARTNERS PAYMENT API: Update data received:', updateData);

    // ✅ ARCHITECTURAL PATTERN: Update partner payment settings
    const { data: updatedPartner, error: updateError } = await supabaseService.getClient()
      .from('partners')
      .update({
        payment_method: updateData.payment_method,
        payment_details: updateData.payment_details,
        updated_at: new Date().toISOString()
      })
      .eq('email', user.email)
      .select()
      .single();

    if (updateError) {
      console.error('❌ PARTNERS PAYMENT API: Update failed:', updateError);
      return NextResponse.json(
        { error: 'Failed to update payment settings' },
        { status: 500 }
      );
    }

    console.log('✅ PARTNERS PAYMENT API: Payment settings updated successfully');
    return NextResponse.json(updatedPartner);

  } catch (error) {
    console.error('💥 PARTNERS PAYMENT API: Error:', error);
    return NextResponse.json(
      { error: 'Failed to update payment settings' },
      { status: 500 }
    );
  }
}