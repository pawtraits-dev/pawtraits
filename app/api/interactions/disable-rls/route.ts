import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Temporarily disable RLS for testing
export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({
        success: false,
        error: 'Missing service role key in environment'
      }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('Temporarily disabling RLS for testing...');

    // Disable RLS on user_interactions table
    const { error: rlsError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE user_interactions DISABLE ROW LEVEL SECURITY;'
    });

    if (rlsError) {
      console.error('RLS disable error:', rlsError);
    }

    // Test access
    const { data: testData, error: testError } = await supabase
      .from('user_interactions')
      .select('id')
      .limit(1);

    return NextResponse.json({
      success: !testError,
      message: testError ? 'Still cannot access table' : 'RLS disabled, table accessible',
      rlsError: rlsError?.message,
      testError: testError?.message,
      testDataCount: testData?.length || 0
    });

  } catch (error) {
    console.error('Error disabling RLS:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to disable RLS',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Re-enable RLS
export async function DELETE(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({
        success: false,
        error: 'Missing service role key'
      }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Re-enable RLS
    const { error } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;'
    });

    return NextResponse.json({
      success: !error,
      message: error ? 'Failed to re-enable RLS' : 'RLS re-enabled',
      error: error?.message
    });

  } catch (error) {
    console.error('Error re-enabling RLS:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to re-enable RLS',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}