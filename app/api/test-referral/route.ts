import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Test referral creation with:', body);

    // Test 1: Check if table has the right columns
    const { data: columns, error: columnError } = await supabase.rpc('exec_sql', {
      sql: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'referrals' ORDER BY column_name;`
    });

    if (columnError) {
      // Try alternative method if exec_sql doesn't exist
      const testQuery = await supabase.from('referrals').select('*').limit(0);
      console.log('Table structure check result:', testQuery);
    }

    // Test 2: Try to insert a simple referral directly
    const testData = {
      partner_id: body.partner_id || '00000000-0000-0000-0000-000000000000', // dummy ID
      referral_code: 'TEST' + Date.now(),
      client_first_name: 'Test',
      client_last_name: 'User',
      client_email: 'test@example.com',
      referral_type: 'traditional',
      status: 'invited',
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };

    const { data: insertResult, error: insertError } = await supabase
      .from('referrals')
      .insert(testData)
      .select()
      .single();

    return NextResponse.json({
      success: !insertError,
      columns: columns || 'Could not fetch columns',
      insertResult,
      insertError: insertError?.message,
      testData
    });

  } catch (error) {
    console.error('Test error:', error);
    return NextResponse.json(
      { error: 'Test failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}