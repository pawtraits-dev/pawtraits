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
    const { 
      email_orders, 
      email_marketing, 
      email_promotions, 
      sms_orders, 
      push_notifications 
    } = updates;

    // Update notification preferences in the user_profiles table
    const { data: updatedProfile, error: updateError } = await supabase
      .from('user_profiles')
      .update({
        notification_preferences: {
          email_orders,
          email_marketing,
          email_promotions,
          sms_orders,
          push_notifications
        },
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('user_type', 'customer')
      .select()
      .single();

    if (updateError) {
      console.error('Error updating customer notification preferences:', updateError);
      return NextResponse.json(
        { error: 'Failed to update notification preferences' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      profile: updatedProfile
    });

  } catch (error) {
    console.error('Error in customer notifications API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
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

    // Get current notification preferences
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('notification_preferences')
      .eq('user_id', user.id)
      .eq('user_type', 'customer')
      .single();

    if (profileError) {
      console.error('Error fetching customer notification preferences:', profileError);
      return NextResponse.json(
        { error: 'Failed to get notification preferences' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      preferences: profile?.notification_preferences || {
        email_orders: true,
        email_marketing: false,
        email_promotions: true,
        sms_orders: false,
        push_notifications: true
      }
    });

  } catch (error) {
    console.error('Error in customer notifications GET API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}