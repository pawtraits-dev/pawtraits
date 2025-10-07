import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    
    if (!email) {
      return NextResponse.json({ error: 'Email required in query params' }, { status: 400 });
    }

    // Use service role key
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

    console.log('🔧 Simple pets debug for email:', email);

    // Step 1: Find user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('email', email)
      .eq('user_type', 'customer')
      .single();

    console.log('🔧 Profile found:', profile, 'Error:', profileError);

    if (!profile) {
      return NextResponse.json({ 
        error: 'No customer profile found',
        email: email,
        profileError: profileError
      });
    }

    // Step 2: Direct pets query
    const { data: directPets, error: directError } = await supabase
      .from('pets')
      .select('*')
      .eq('user_id', profile.user_id);

    console.log('🔧 Direct pets query:', directPets, 'Error:', directError);

    // Step 3: RPC function
    const { data: rpcPets, error: rpcError } = await supabase
      .rpc('get_user_pets', { user_uuid: profile.user_id });

    console.log('🔧 RPC pets query:', rpcPets, 'Error:', rpcError);

    // Step 4: Check if pets table exists and structure
    const { data: tableCheck } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'pets');

    console.log('🔧 Pets table exists:', tableCheck);

    return NextResponse.json({
      success: true,
      email: email,
      profile: profile,
      profileError: profileError,
      directPets: directPets,
      directError: directError,
      rpcPets: rpcPets,
      rpcError: rpcError,
      tableExists: (tableCheck?.length || 0) > 0,
      summary: {
        profileFound: !!profile,
        directPetsCount: directPets?.length || 0,
        rpcPetsCount: rpcPets?.length || 0,
        userId: profile?.user_id
      }
    });

  } catch (error) {
    console.log('🔧 Debug error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}