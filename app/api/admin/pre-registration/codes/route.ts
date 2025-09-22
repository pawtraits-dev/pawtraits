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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const campaign = searchParams.get('campaign');

    // Get pre-registration codes with partner information
    const { data, error } = await supabaseService.getClient().rpc('get_pre_registration_codes_with_partner', {
      p_status_filter: status === 'all' ? null : status,
      p_campaign_filter: campaign === 'all' ? null : campaign
    });

    if (error) {
      console.error('Failed to fetch pre-registration codes:', error);
      return NextResponse.json({ error: 'Failed to fetch codes' }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Pre-registration codes API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseService = new SupabaseService();

    // Check admin authentication
    const admin = await supabaseService.getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 401 });
    }

    const body = await request.json();
    const { code, business_category, marketing_campaign, expiration_date } = body;

    // Validate required fields
    if (!code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    // Create pre-registration code
    const { data, error } = await supabaseService.getClient().rpc('create_pre_registration_code', {
      p_code: code,
      p_business_category: business_category || null,
      p_marketing_campaign: marketing_campaign || null,
      p_expiration_date: expiration_date || null
    });

    if (error) {
      console.error('Failed to create pre-registration code:', error);
      if (error.code === '23505') { // Unique constraint violation
        return NextResponse.json({ error: 'Code already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to create code' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Pre-registration code creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}