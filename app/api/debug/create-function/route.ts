import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role client
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
    
    console.log('🔧 Creating get_user_pets function...');
    
    // SQL to create the function
    const createFunctionSQL = `
-- Create function to get user's pets with breed/coat details
CREATE OR REPLACE FUNCTION get_user_pets(user_uuid UUID)
RETURNS TABLE (
  pet_id UUID,
  name TEXT,
  age INTEGER,
  birthday DATE,
  gender TEXT,
  weight DECIMAL,
  primary_photo_url TEXT,
  photo_urls TEXT[],
  personality_traits TEXT[],
  special_notes TEXT,
  breed_id UUID,
  breed_name TEXT,
  breed_slug TEXT,
  coat_id UUID,
  coat_name TEXT,
  coat_slug TEXT,
  coat_hex_color TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.age,
    p.birthday,
    p.gender,
    p.weight,
    p.primary_photo_url,
    p.photo_urls,
    p.personality_traits,
    p.special_notes,
    p.breed_id,
    b.name as breed_name,
    b.slug as breed_slug,
    p.coat_id,
    c.name as coat_name,
    c.slug as coat_slug,
    c.hex_color as coat_hex_color,
    p.created_at
  FROM public.pets p
  LEFT JOIN public.breeds b ON p.breed_id = b.id
  LEFT JOIN public.coats c ON p.coat_id = c.id
  WHERE p.user_id = user_uuid 
    AND p.is_active = true
  ORDER BY p.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_pets TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_pets TO anon;
    `;
    
    // Execute the SQL using rpc
    const { data: result, error: createError } = await supabase.rpc('exec_sql', { 
      sql: createFunctionSQL 
    });
    
    if (createError) {
      console.log('🔧 Error creating function via rpc:', createError);
      
      // Try alternative approach - execute pieces separately
      const pieces = [
        `CREATE OR REPLACE FUNCTION get_user_pets(user_uuid UUID)
RETURNS TABLE (
  pet_id UUID,
  name TEXT,
  age INTEGER,
  birthday DATE,
  gender TEXT,
  weight DECIMAL,
  primary_photo_url TEXT,
  photo_urls TEXT[],
  personality_traits TEXT[],
  special_notes TEXT,
  breed_id UUID,
  breed_name TEXT,
  breed_slug TEXT,
  coat_id UUID,
  coat_name TEXT,
  coat_slug TEXT,
  coat_hex_color TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.age,
    p.birthday,
    p.gender,
    p.weight,
    p.primary_photo_url,
    p.photo_urls,
    p.personality_traits,
    p.special_notes,
    p.breed_id,
    b.name as breed_name,
    b.slug as breed_slug,
    p.coat_id,
    c.name as coat_name,
    c.slug as coat_slug,
    c.hex_color as coat_hex_color,
    p.created_at
  FROM public.pets p
  LEFT JOIN public.breeds b ON p.breed_id = b.id
  LEFT JOIN public.coats c ON p.coat_id = c.id
  WHERE p.user_id = user_uuid 
    AND p.is_active = true
  ORDER BY p.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER`,
        `GRANT EXECUTE ON FUNCTION get_user_pets TO authenticated`,
        `GRANT EXECUTE ON FUNCTION get_user_pets TO anon`
      ];
      
      return NextResponse.json({
        success: false,
        error: 'Function creation failed',
        createError: createError,
        note: 'The database function needs to be created manually. Please run the SQL from scripts/create-pets-table.sql'
      });
    }
    
    console.log('🔧 Function creation result:', result);
    
    // Test the function
    const testUserId = '00000000-0000-0000-0000-000000000000';
    const { data: testResult, error: testError } = await supabase
      .rpc('get_user_pets', { user_uuid: testUserId });
    
    console.log('🔧 Function test after creation:', testResult, 'Error:', testError);
    
    return NextResponse.json({
      success: true,
      message: 'Function created successfully',
      result: result,
      testResult: testResult,
      testError: testError
    });
    
  } catch (error) {
    console.log('🔧 Debug error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}