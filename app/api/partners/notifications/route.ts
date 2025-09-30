import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';

// ✅ ARCHITECTURAL PATTERN: Partner notification preferences API endpoint

export async function PUT(request: NextRequest) {
  try {
    console.log('🏗️ PARTNERS NOTIFICATIONS API: PUT request received');

    const supabaseService = new SupabaseService();

    // ✅ ARCHITECTURAL PATTERN: Get authenticated user
    const { data: { user }, error: authError } = await supabaseService.getClient().auth.getUser();

    if (authError || !user) {
      console.log('❌ PARTNERS NOTIFICATIONS API: Authentication failed');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const updateData = await request.json();
    console.log('📝 PARTNERS NOTIFICATIONS API: Update data received:', updateData);

    // ✅ ARCHITECTURAL PATTERN: Update partner notification preferences
    const { data: updatedPartner, error: updateError } = await supabaseService.getClient()
      .from('partners')
      .update({
        notification_preferences: updateData.notification_preferences,
        updated_at: new Date().toISOString()
      })
      .eq('email', user.email)
      .select()
      .single();

    if (updateError) {
      console.error('❌ PARTNERS NOTIFICATIONS API: Update failed:', updateError);
      return NextResponse.json(
        { error: 'Failed to update notification preferences' },
        { status: 500 }
      );
    }

    console.log('✅ PARTNERS NOTIFICATIONS API: Notification preferences updated successfully');
    return NextResponse.json(updatedPartner);

  } catch (error) {
    console.error('💥 PARTNERS NOTIFICATIONS API: Error:', error);
    return NextResponse.json(
      { error: 'Failed to update notification preferences' },
      { status: 500 }
    );
  }
}