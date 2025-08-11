import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Get the current user from the session
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const updates = await request.json();
    const { first_name, last_name, phone } = updates;

    // Update the user profile in the user_profiles table
    const { data: updatedProfile, error: updateError } = await supabase
      .from('user_profiles')
      .update({
        first_name,
        last_name,
        phone,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('user_type', 'customer')
      .select()
      .single();

    if (updateError) {
      console.error('Error updating customer profile:', updateError);
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      profile: updatedProfile
    });

  } catch (error) {
    console.error('Error in customer profile API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}