import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';

const supabaseService = new SupabaseService();

export async function GET(request: NextRequest) {
  try {
    // Get all referrals with basic info to debug
    const { data: referrals, error } = await supabaseService['supabase']
      .from('referrals')
      .select(`
        id,
        referral_code,
        client_first_name,
        client_last_name,
        client_email,
        status,
        referral_type,
        image_id,
        expires_at,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching referrals:', error);
      return NextResponse.json({ error: 'Failed to fetch referrals', details: error }, { status: 500 });
    }

    console.log('Debug: Found referrals:', referrals);

    return NextResponse.json({
      count: referrals?.length || 0,
      referrals: referrals || [],
      message: 'Debug info'
    });

  } catch (error) {
    console.error('Debug API error:', error);
    return NextResponse.json(
      { error: 'Debug failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}