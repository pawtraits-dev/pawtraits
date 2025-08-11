import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Test different queries to debug the issue
    const results: any = {};

    // Test 1: Simple count
    try {
      const { count, error: countError } = await supabase
        .from('media')
        .select('*', { count: 'exact', head: true });
      
      results.count_test = {
        success: !countError,
        count,
        error: countError?.message || null
      };
    } catch (err) {
      results.count_test = {
        success: false,
        error: String(err)
      };
    }

    // Test 2: Simple select without order
    try {
      const { data, error } = await supabase
        .from('media')
        .select('*')
        .limit(5);
      
      results.simple_select = {
        success: !error,
        rowCount: data?.length || 0,
        data: data?.slice(0, 2) || [], // Just first 2 rows for debugging
        error: error?.message || null
      };
    } catch (err) {
      results.simple_select = {
        success: false,
        error: String(err)
      };
    }

    // Test 3: Select with order (this is what's failing)
    try {
      const { data, error } = await supabase
        .from('media')
        .select('*')
        .order('display_order', { ascending: true });
      
      results.ordered_select = {
        success: !error,
        rowCount: data?.length || 0,
        error: error?.message || null
      };
    } catch (err) {
      results.ordered_select = {
        success: false,
        error: String(err)
      };
    }

    // Test 4: Check table structure
    try {
      const { data, error } = await supabase
        .from('media')
        .select('id, name, slug, display_order')
        .limit(1);
      
      results.column_test = {
        success: !error,
        columns_exist: data ? Object.keys(data[0] || {}) : [],
        error: error?.message || null
      };
    } catch (err) {
      results.column_test = {
        success: false,
        error: String(err)
      };
    }

    return NextResponse.json({
      message: 'Media debug completed',
      results
    });

  } catch (error) {
    console.error('Error in media debug:', error);
    return NextResponse.json(
      { error: 'Debug failed', details: error },
      { status: 500 }
    );
  }
}