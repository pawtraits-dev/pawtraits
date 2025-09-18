import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();

    // Create Supabase client that can read from cookies
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    // Get current user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({
        isAuthenticated: false,
        user: null
      });
    }

    // Try to get basic user profile using service role
    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
      const { data: profile } = await serviceRoleSupabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      return NextResponse.json({
        isAuthenticated: true,
        user: {
          id: user.id,
          email: user.email,
          ...profile
        }
      });
    } catch (profileError) {
      console.warn('Could not load user profile:', profileError);

      // Return basic auth info even if profile fails
      return NextResponse.json({
        isAuthenticated: true,
        user: {
          id: user.id,
          email: user.email
        }
      });
    }

  } catch (error) {
    console.error('Error in auth check:', error);
    return NextResponse.json({
      isAuthenticated: false,
      user: null
    });
  }
}