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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const campaign = searchParams.get('campaign');

    // Get pre-registration codes (direct table query for now)
    let query = supabase
      .from('pre_registration_codes')
      .select(`
        *,
        partner:partners(id, business_name, first_name, last_name)
      `)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (campaign && campaign !== 'all') {
      query = query.eq('marketing_campaign', campaign);
    }

    const { data, error } = await query;

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

    const body = await request.json();
    const { code, business_category, marketing_campaign, expiration_date } = body;

    // Validate required fields
    if (!code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    // Create pre-registration code (direct insert for now)
    const { data, error } = await supabase
      .from('pre_registration_codes')
      .insert({
        code: code,
        business_category: business_category || null,
        marketing_campaign: marketing_campaign || null,
        expiration_date: expiration_date || null,
        status: 'active',
        scans_count: 0,
        conversions_count: 0,
        print_quantity: 1
      })
      .select()
      .single();

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