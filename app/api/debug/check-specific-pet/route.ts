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
    const petId = searchParams.get('petId');
    const email = searchParams.get('email');
    
    if (!petId || !email) {
      return NextResponse.json({ error: 'petId and email required' }, { status: 400 });
    }
    
    console.log('🔧 Checking specific pet:', petId, 'for email:', email);
    
    // Check if pet exists in database
    const { data: pet, error: petError } = await supabase
      .from('pets')
      .select('*')
      .eq('id', petId)
      .single();
    
    console.log('🔧 Pet exists:', pet, 'Error:', petError);
    
    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('email', email)
      .single();
    
    console.log('🔧 User profile:', profile, 'Error:', profileError);
    
    // Check if pet belongs to this user
    const userMatch = pet && profile && pet.user_id === profile.user_id;
    console.log('🔧 Pet belongs to user:', userMatch, 'Pet user_id:', pet?.user_id, 'Profile user_id:', profile?.user_id);
    
    // Test get_user_pets function specifically
    const { data: functionResult, error: functionError } = await supabase
      .rpc('get_user_pets', { user_uuid: profile?.user_id });
    
    console.log('🔧 get_user_pets result:', functionResult, 'Error:', functionError);
    
    // Check if our specific pet is in the function results
    const petInResults = functionResult?.find((p: any) => p.pet_id === petId);
    console.log('🔧 Specific pet in function results:', petInResults);
    
    // Check breeds table to see if breed exists
    let breedCheck = null;
    if (pet?.breed_id) {
      const { data: breed, error: breedError } = await supabase
        .from('breeds')
        .select('*')
        .eq('id', pet.breed_id)
        .single();
      breedCheck = { breed, breedError };
      console.log('🔧 Breed check:', breedCheck);
    }
    
    // Check coats table to see if coat exists  
    let coatCheck = null;
    if (pet?.coat_id) {
      const { data: coat, error: coatError } = await supabase
        .from('coats')
        .select('*')
        .eq('id', pet.coat_id)
        .single();
      coatCheck = { coat, coatError };
      console.log('🔧 Coat check:', coatCheck);
    }
    
    return NextResponse.json({
      success: true,
      petId: petId,
      email: email,
      pet: pet,
      petError: petError,
      profile: profile,
      profileError: profileError,
      userMatch: userMatch,
      functionResult: functionResult,
      functionError: functionError,
      petInResults: petInResults,
      breedCheck: breedCheck,
      coatCheck: coatCheck
    });
    
  } catch (error) {
    console.log('🔧 Debug error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}