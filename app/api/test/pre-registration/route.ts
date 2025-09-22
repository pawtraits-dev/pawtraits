import { NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';

export async function GET() {
  const results = {
    table_access: 'UNKNOWN',
    create_function: 'UNKNOWN',
    stats_function: 'UNKNOWN',
    details: {}
  };

  try {
    const supabaseService = new SupabaseService();

    // Test 1: Check if pre_registration_codes table exists and is accessible
    try {
      const { count, error: tableError } = await supabaseService.getClient()
        .from('pre_registration_codes')
        .select('*', { count: 'exact', head: true });

      if (tableError) {
        results.table_access = 'FAILED';
        results.details.table_error = tableError;
      } else {
        results.table_access = 'OK';
        results.details.table_count = count;
      }
    } catch (error) {
      results.table_access = 'FAILED';
      results.details.table_error = error;
    }

    // Test 2: Check if the create function exists (only if table access works)
    if (results.table_access === 'OK') {
      try {
        const { data: createTest, error: createError } = await supabaseService.getClient()
          .rpc('create_pre_registration_code', {
            p_code: 'TEST001',
            p_business_category: 'test',
            p_marketing_campaign: 'test-campaign',
            p_expiration_date: null
          });

        if (createError) {
          results.create_function = 'FAILED';
          results.details.create_error = createError;
        } else {
          results.create_function = 'OK';
          results.details.created_code = createTest;

          // Clean up test data
          if (createTest && createTest[0]?.id) {
            await supabaseService.getClient()
              .from('pre_registration_codes')
              .delete()
              .eq('id', createTest[0].id);
          }
        }
      } catch (error) {
        results.create_function = 'FAILED';
        results.details.create_error = error;
      }
    }

    // Test 3: Check if the stats function exists (only if table access works)
    if (results.table_access === 'OK') {
      try {
        const { data: statsTest, error: statsError } = await supabaseService.getClient()
          .rpc('get_pre_registration_stats');

        if (statsError) {
          results.stats_function = 'FAILED';
          results.details.stats_error = statsError;
        } else {
          results.stats_function = 'OK';
          results.details.stats_result = statsTest;
        }
      } catch (error) {
        results.stats_function = 'FAILED';
        results.details.stats_error = error;
      }
    }

    const allPassed = results.table_access === 'OK' &&
                     results.create_function === 'OK' &&
                     results.stats_function === 'OK';

    return NextResponse.json({
      success: allPassed,
      message: allPassed ?
        'All pre-registration database functions are working correctly' :
        'Some pre-registration database components failed',
      results
    });

  } catch (error) {
    console.error('Pre-registration test error:', error);
    return NextResponse.json({
      success: false,
      error: 'Unexpected error during testing',
      details: error instanceof Error ? error.message : 'Unknown error',
      results
    }, { status: 500 });
  }
}