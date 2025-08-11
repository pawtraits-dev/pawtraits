import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Check if key tables exist
    const tablesToCheck = ['media', 'products', 'formats', 'product_pricing'];
    const results: Record<string, any> = {};

    for (const tableName of tablesToCheck) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);

        results[tableName] = {
          exists: !error,
          error: error?.message || null,
          recordCount: data?.length || 0
        };
      } catch (err) {
        results[tableName] = {
          exists: false,
          error: String(err),
          recordCount: 0
        };
      }
    }

    return NextResponse.json({
      message: 'Table check completed',
      tables: results
    });

  } catch (error) {
    console.error('Error checking tables:', error);
    return NextResponse.json(
      { error: 'Failed to check tables', details: error },
      { status: 500 }
    );
  }
}