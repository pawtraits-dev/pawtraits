import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    // TODO: Add admin authentication check

    // Use service role key for admin operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get pre-registration stats
    const { data, error } = await supabase.rpc('get_pre_registration_stats');

    if (error) {
      console.error('Failed to fetch pre-registration stats:', error);
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }

    // Return stats with proper formatting
    const stats = data?.[0] || {
      total_codes: 0,
      active_codes: 0,
      used_codes: 0,
      expired_codes: 0,
      total_scans: 0,
      conversion_rate: 0
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Pre-registration stats API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}