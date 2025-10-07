import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role client to bypass RLS
function getServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getServiceRoleClient();
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }
    
    console.log('🔧 Testing get_user_pets for email:', email);
    
    // First get the user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('email', email)
      .single();
    
    if (profileError || !profile) {
      console.log('🔧 Profile error:', profileError);
      return NextResponse.json({ 
        error: 'Profile not found', 
        details: profileError 
      }, { status: 404 });
    }
    
    console.log('🔧 Found profile:', profile);
    
    // Test direct pets query
    const { data: directPets, error: directError } = await supabase
      .from('pets')
      .select('*')
      .eq('user_id', profile.user_id);
    
    console.log('🔧 Direct pets query result:', directPets, 'Error:', directError);
    
    // Test get_user_pets function
    const { data: functionPets, error: functionError } = await supabase
      .rpc('get_user_pets', { user_uuid: profile.user_id });
    
    console.log('🔧 get_user_pets function result:', functionPets, 'Error:', functionError);
    
    return NextResponse.json({
      success: true,
      profile: profile,
      directPets: directPets,
      directError: directError,
      functionPets: functionPets,
      functionError: functionError
    });
    
  } catch (error) {
    console.log('🔧 Debug error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}