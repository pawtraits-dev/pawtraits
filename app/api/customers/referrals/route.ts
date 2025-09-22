import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase-client';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET - Fetch customer referral data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerEmail = searchParams.get('email');

    if (!customerEmail) {
      return NextResponse.json({ error: 'Email parameter is required' }, { status: 400 });
    }

    // Verify customer authentication
    const supabase = getSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user?.email || user.email !== customerEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use service role to fetch customer referral data
    const serviceSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: referral, error } = await serviceSupabase
      .from('customer_referrals')
      .select(`
        id,
        referral_code,
        total_referrals,
        successful_referrals,
        total_earned,
        status,
        created_at
      `)
      .eq('customer_email', customerEmail)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching customer referral:', error);
      return NextResponse.json({ error: 'Failed to fetch referral data' }, { status: 500 });
    }

    // If no referral found, return null (not an error)
    if (error?.code === 'PGRST116') {
      return NextResponse.json({ referral: null });
    }

    return NextResponse.json({ referral });

  } catch (error) {
    console.error('Customer referral fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create customer referral code
export async function POST(request: NextRequest) {
  try {
    const { customerEmail, customerName } = await request.json();

    if (!customerEmail || !customerName) {
      return NextResponse.json(
        { error: 'Customer email and name are required' },
        { status: 400 }
      );
    }

    // Verify customer authentication
    const supabase = getSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user?.email || user.email !== customerEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use service role to create customer referral
    const serviceSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Check if customer already has a referral code
    const { data: existing } = await serviceSupabase
      .from('customer_referrals')
      .select('id, referral_code')
      .eq('customer_email', customerEmail)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Customer already has a referral code', referral: existing },
        { status: 409 }
      );
    }

    // Create new customer referral using the database function
    const { data: referral, error } = await serviceSupabase
      .rpc('create_customer_referral', {
        p_customer_email: customerEmail,
        p_customer_name: customerName
      });

    if (error) {
      console.error('Error creating customer referral:', error);
      return NextResponse.json({ error: 'Failed to create referral code' }, { status: 500 });
    }

    // Fetch the full referral data
    const { data: fullReferral, error: fetchError } = await serviceSupabase
      .from('customer_referrals')
      .select(`
        id,
        referral_code,
        total_referrals,
        successful_referrals,
        total_earned,
        status,
        created_at
      `)
      .eq('customer_email', customerEmail)
      .single();

    if (fetchError) {
      console.error('Error fetching created referral:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch referral data' }, { status: 500 });
    }

    return NextResponse.json({ referral: fullReferral });

  } catch (error) {
    console.error('Customer referral creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}