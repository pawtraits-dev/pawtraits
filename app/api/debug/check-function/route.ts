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

export async function GET(request: NextRequest) {
  try {
    const supabase = getServiceRoleClient();
    
    console.log('🔧 Checking if get_user_pets function exists...');
    
    // Check if function exists by trying to get its definition
    const { data: functions, error: functionsError } = await supabase
      .from('information_schema.routines')
      .select('routine_name, routine_definition')
      .eq('routine_name', 'get_user_pets')
      .eq('routine_type', 'FUNCTION');
    
    console.log('🔧 Functions check result:', functions, 'Error:', functionsError);
    
    // Try to test the function with a fake UUID to see if it exists
    const testUserId = '00000000-0000-0000-0000-000000000000';
    const { data: testResult, error: testError } = await supabase
      .rpc('get_user_pets', { user_uuid: testUserId });
    
    console.log('🔧 Function test result:', testResult, 'Error:', testError);
    
    return NextResponse.json({
      success: true,
      functions: functions,
      functionsError: functionsError,
      testResult: testResult,
      testError: testError,
      functionExists: !testError || testError.code !== 'PGRST202' // PGRST202 means function not found
    });
    
  } catch (error) {
    console.log('🔧 Debug error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}