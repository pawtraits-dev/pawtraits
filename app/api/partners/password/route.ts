import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';

// ✅ ARCHITECTURAL PATTERN: Partner password update API endpoint

export async function PUT(request: NextRequest) {
  try {
    console.log('🏗️ PARTNERS PASSWORD API: PUT request received');

    const supabaseService = new SupabaseService();

    // ✅ ARCHITECTURAL PATTERN: Get authenticated user
    const { data: { user }, error: authError } = await supabaseService.getClient().auth.getUser();

    if (authError || !user) {
      console.log('❌ PARTNERS PASSWORD API: Authentication failed');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const updateData = await request.json();
    console.log('📝 PARTNERS PASSWORD API: Password update request received');

    // ✅ ARCHITECTURAL PATTERN: Update user password via Supabase Auth
    const { data, error: passwordError } = await supabaseService.getClient().auth.updateUser({
      password: updateData.newPassword
    });

    if (passwordError) {
      console.error('❌ PARTNERS PASSWORD API: Password update failed:', passwordError);
      return NextResponse.json(
        { error: 'Failed to update password' },
        { status: 400 }
      );
    }

    console.log('✅ PARTNERS PASSWORD API: Password updated successfully');
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('💥 PARTNERS PASSWORD API: Error:', error);
    return NextResponse.json(
      { error: 'Failed to update password' },
      { status: 500 }
    );
  }
}