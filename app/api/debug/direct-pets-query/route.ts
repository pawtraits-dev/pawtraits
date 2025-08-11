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
    
    console.log('🔧 Direct pets query for email:', email);
    
    // Get user profile first
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('email', email)
      .single();
    
    console.log('🔧 Profile:', profile, 'Error:', profileError);
    
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
    
    // Direct query to pets table
    const { data: pets, error: petsError } = await supabase
      .from('pets')
      .select(`
        id,
        name,
        user_id,
        breed_id,
        coat_id,
        age,
        birthday,
        gender,
        weight,
        primary_photo_url,
        photo_urls,
        personality_traits,
        special_notes,
        is_active,
        created_at,
        breeds(name, slug),
        coats(name, slug, hex_color)
      `)
      .eq('user_id', profile.user_id);
    
    console.log('🔧 Direct pets query result:', pets, 'Error:', petsError);
    
    return NextResponse.json({
      success: true,
      profile: profile,
      pets: pets,
      petsError: petsError,
      totalPets: pets?.length || 0
    });
    
  } catch (error) {
    console.log('🔧 Debug error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}