import { NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';

export async function GET() {
  try {
    const supabaseService = new SupabaseService();

    // Test 1: Check if pre_registration_codes table exists and is accessible
    const { data: tableData, error: tableError } = await supabaseService.getClient()
      .from('pre_registration_codes')
      .select('count(*)')
      .limit(1);

    if (tableError) {
      return NextResponse.json({
        success: false,
        error: 'pre_registration_codes table access failed',
        details: tableError
      });
    }

    // Test 2: Check if the create function exists
    const { data: createTest, error: createError } = await supabaseService.getClient()
      .rpc('create_pre_registration_code', {
        p_code: 'TEST001',
        p_business_category: 'test',
        p_marketing_campaign: 'test-campaign',
        p_expiration_date: null
      });

    if (createError) {
      return NextResponse.json({
        success: false,
        error: 'create_pre_registration_code function failed',
        details: createError
      });
    }

    // Test 3: Check if the stats function exists
    const { data: statsTest, error: statsError } = await supabaseService.getClient()
      .rpc('get_pre_registration_stats');

    if (statsError) {
      return NextResponse.json({
        success: false,
        error: 'get_pre_registration_stats function failed',
        details: statsError
      });
    }

    // Clean up test data
    if (createTest && createTest[0]?.id) {
      await supabaseService.getClient()
        .from('pre_registration_codes')
        .delete()
        .eq('id', createTest[0].id);
    }

    return NextResponse.json({
      success: true,
      message: 'All pre-registration database functions are working correctly',
      tests: {
        table_access: 'OK',
        create_function: 'OK',
        stats_function: 'OK',
        created_test_code: createTest?.[0]?.code || 'N/A',
        stats_result: statsTest?.[0] || 'N/A'
      }
    });

  } catch (error) {
    console.error('Pre-registration test error:', error);
    return NextResponse.json({
      success: false,
      error: 'Unexpected error during testing',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}