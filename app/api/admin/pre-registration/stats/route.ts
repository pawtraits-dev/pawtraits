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

    // Get pre-registration stats (manual calculation for now)
    const { data: codes, error } = await supabase
      .from('pre_registration_codes')
      .select('status, scans_count, conversions_count');

    if (error) {
      console.error('Failed to fetch codes for stats:', error);
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }

    // Calculate stats manually
    const total_codes = codes?.length || 0;
    const active_codes = codes?.filter(c => c.status === 'active').length || 0;
    const used_codes = codes?.filter(c => c.status === 'used').length || 0;
    const expired_codes = codes?.filter(c => c.status === 'expired').length || 0;
    const total_scans = codes?.reduce((sum, c) => sum + (c.scans_count || 0), 0) || 0;
    const total_conversions = codes?.reduce((sum, c) => sum + (c.conversions_count || 0), 0) || 0;
    const conversion_rate = total_scans > 0 ? total_conversions / total_scans : 0;

    const stats = {
      total_codes,
      active_codes,
      used_codes,
      expired_codes,
      total_scans,
      conversion_rate
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Pre-registration stats API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}