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

export async function POST(request: NextRequest) {
  try {
    const supabase = getServiceRoleClient();
    const body = await request.json();
    
    console.log('🔧 Debug pet add received:', body);
    
    // Test the exact same insertion
    const petData = {
      user_id: body.user_id,
      name: body.name?.trim(),
      breed_id: body.breed_id,
      coat_id: body.coat_id || null,
      gender: body.gender || 'unknown',
      age: body.age || null,
      birthday: body.birthday || null,
      weight: body.weight || null,
      personality_traits: body.personality_traits || [],
      special_notes: body.special_notes?.trim() || null
    };
    
    console.log('🔧 Debug inserting pet data:', petData);
    
    // Check if user_pets table exists and its structure
    const { data: tableInfo, error: tableError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'user_pets')
      .order('ordinal_position');
    
    console.log('🔧 user_pets table structure:', tableInfo);
    
    if (tableError) {
      console.log('🔧 Error getting table info:', tableError);
    }
    
    // Try the insert
    const { data, error } = await supabase
      .from('user_pets')
      .insert(petData)
      .select()
      .single();
    
    if (error) {
      console.log('🔧 Insert error:', error);
      return NextResponse.json({
        success: false,
        error: error,
        petData: petData,
        tableStructure: tableInfo
      });
    }
    
    console.log('🔧 Insert successful:', data);
    
    return NextResponse.json({
      success: true,
      data: data,
      petData: petData,
      tableStructure: tableInfo
    });
    
  } catch (error) {
    console.log('🔧 Debug error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}