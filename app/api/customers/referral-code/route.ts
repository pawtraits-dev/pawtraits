import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerEmail = searchParams.get('email');

    if (!customerEmail) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Use service role key to fetch customer data
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Fetch customer's personal referral code
    const { data: customer, error } = await supabase
      .from('customers')
      .select('id, personal_referral_code, personal_qr_code_url')
      .eq('email', customerEmail.toLowerCase().trim())
      .single();

    if (error || !customer) {
      console.error('Failed to fetch customer referral code:', error);
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    if (!customer.personal_referral_code) {
      return NextResponse.json({ error: 'No referral code found for customer' }, { status: 404 });
    }

    // Return code, share URL, and QR code URL
    return NextResponse.json({
      code: customer.personal_referral_code,
      share_url: `/c/${customer.personal_referral_code}`,
      qr_code_url: customer.personal_qr_code_url
    });

  } catch (error) {
    console.error('Customer referral code API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
