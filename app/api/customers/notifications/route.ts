import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies();
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

    // Use service role client for database operations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get user profile
    const { data: userProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('email', user.email)
      .single();

    if (!userProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    // Upsert notification preferences
    const { data: preferences, error: updateError } = await supabaseAdmin
      .from('user_notification_preferences')
      .upsert({
        user_id: userProfile.id,
        user_type: 'customer',
        email_enabled: updates.email_enabled ?? true,
        sms_enabled: updates.sms_enabled ?? true,
        inbox_enabled: updates.inbox_enabled ?? true,
        operational_emails_enabled: updates.operational_emails_enabled ?? true,
        marketing_emails_enabled: updates.marketing_emails_enabled ?? false,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
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
      preferences
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
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Get the current user from the session
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Use service role client for database operations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get user profile
    const { data: userProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('email', user.email)
      .single();

    if (!userProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    // Get or create notification preferences
    const { data: prefsData } = await supabaseAdmin
      .rpc('get_user_notification_preferences', { p_user_id: userProfile.id });

    const preferences = prefsData && prefsData.length > 0 ? prefsData[0] : null;

    // Get available templates for customers
    const { data: templates } = await supabaseAdmin
      .from('message_templates')
      .select('template_key, name, description, category, can_be_disabled')
      .contains('user_types', ['customer'])
      .eq('is_active', true)
      .order('name');

    return NextResponse.json({
      success: true,
      preferences,
      templates: templates || []
    });

  } catch (error) {
    console.error('Error in customer notifications GET API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}