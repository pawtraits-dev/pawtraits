import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Debug endpoint that doesn't require auth session - used by layout components
export async function GET(request: Request) {
  try {
    // Use service role to bypass auth
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    
    if (!email) {
      return NextResponse.json({ 
        error: 'Please provide email parameter: ?email=user@example.com' 
      }, { status: 400 });
    }

    console.log(`Debug check for email: ${email}`);

    // Get auth user by email
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
      console.error('Auth error:', authError);
      return NextResponse.json({ 
        error: 'Failed to fetch auth users',
        details: authError.message 
      }, { status: 500 });
    }

    const authUser = authUsers?.users.find(u => u.email === email);

    if (!authUser) {
      return NextResponse.json({ 
        error: `No auth user found for email: ${email}`,
        suggestion: 'User may need to sign up first'
      }, { status: 404 });
    }

    console.log(`Found auth user: ${authUser.id}`);

    // Get user profile using the RPC function to avoid RLS issues
    const { data: userProfile, error: profileError } = await supabase
      .rpc('get_user_profile', { user_uuid: authUser.id });

    if (profileError) {
      console.error('Profile RPC error:', profileError);
      // Try direct query as fallback
      const { data: directProfile, error: directError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', authUser.id)
        .single();

      if (directError) {
        console.error('Direct profile query error:', directError);
        return NextResponse.json({
          error: 'Failed to fetch user profile',
          authUser: {
            id: authUser.id,
            email: authUser.email,
            created_at: authUser.created_at
          },
          profileRpcError: profileError.message,
          directQueryError: directError.message
        }, { status: 500 });
      }

      // Also get customer data if this is a customer
      let customer = null;
      if (directProfile?.user_type === 'customer') {
        const { data: customerData, error: customerError } = await supabase
          .from('customers')
          .select('*')
          .eq('email', email)
          .single();
        
        if (!customerError && customerData) {
          customer = customerData;
        }
      }

      // Return direct query result
      return NextResponse.json({
        userProfile: directProfile,
        customer: customer,
        authUser: {
          id: authUser.id,
          email: authUser.email,
          created_at: authUser.created_at
        },
        note: 'Used direct query instead of RPC'
      });
    }

    // RPC worked, return the result
    // The RPC returns TABLE, so data should be an array
    const profile = Array.isArray(userProfile) ? userProfile[0] : userProfile;

    if (!profile) {
      return NextResponse.json({
        error: `No user profile found for user ID: ${authUser.id}`,
        authUser: {
          id: authUser.id,
          email: authUser.email,
          created_at: authUser.created_at
        },
        suggestion: 'User profile may need to be created'
      }, { status: 404 });
    }

    console.log(`Found profile: ${profile.user_type} user`);

    // Also get customer data if this is a customer
    let customer = null;
    if (profile.user_type === 'customer') {
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('email', email)
        .single();
      
      if (!customerError && customerData) {
        customer = customerData;
        console.log(`Found customer data for: ${email}`);
      } else {
        console.log(`No customer data found for: ${email}`, customerError?.message);
      }
    }

    return NextResponse.json({
      userProfile: profile,
      customer: customer,
      authUser: {
        id: authUser.id,
        email: authUser.email,
        created_at: authUser.created_at,
        email_confirmed_at: authUser.email_confirmed_at
      },
      success: true
    });

  } catch (error) {
    console.error('Debug check failed:', error);
    return NextResponse.json({
      error: 'Debug check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}