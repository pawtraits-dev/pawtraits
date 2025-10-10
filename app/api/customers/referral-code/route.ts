import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerEmail = searchParams.get('email');

    if (!customerEmail) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Fetch customer's personal referral code for sharing (not the code they used to sign up)
    const { data: customer, error } = await supabase
      .from('customers')
      .select('id, email, personal_referral_code, qr_code_url, referral_code_used, referral_type')
      .eq('email', customerEmail.toLowerCase().trim())
      .single();

    if (error || !customer) {
      console.error('[CUSTOMER REFERRAL CODE] Failed to fetch customer:', {
        email: customerEmail,
        error: error?.message
      });
      return NextResponse.json({
        code: null,
        share_url: null,
        qr_code_url: null
      });
    }

    // Build the share URL for the customer's personal referral code
    const shareUrl = customer.personal_referral_code
      ? `/c/${customer.personal_referral_code}`
      : null;

    console.log('[CUSTOMER REFERRAL CODE] Retrieved personal referral code:', {
      email: customerEmail,
      customerId: customer.id,
      personalReferralCode: customer.personal_referral_code,
      qrCodeUrl: customer.qr_code_url,
      shareUrl: shareUrl
    });

    return NextResponse.json({
      code: customer.personal_referral_code,
      share_url: shareUrl,
      qr_code_url: customer.qr_code_url,
      // Also include referral_code_used for checkout fallback use case
      referral_code_used: customer.referral_code_used,
      referral_type: customer.referral_type
    });

  } catch (error) {
    console.error('[CUSTOMER REFERRAL CODE] API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
