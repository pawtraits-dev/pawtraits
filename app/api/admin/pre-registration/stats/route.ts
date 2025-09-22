import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabaseService = new SupabaseService();

    // Check admin authentication
    const admin = await supabaseService.getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 401 });
    }

    // Get pre-registration stats
    const { data, error } = await supabaseService.getClient().rpc('get_pre_registration_stats');

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