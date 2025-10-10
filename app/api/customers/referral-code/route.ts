import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerEmail = searchParams.get('email');

    console.log('[CUSTOMER REFERRAL CODE] API called with email:', customerEmail);

    if (!customerEmail) {
      console.error('[CUSTOMER REFERRAL CODE] No email provided');
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const normalizedEmail = customerEmail.toLowerCase().trim();
    console.log('[CUSTOMER REFERRAL CODE] Querying with normalized email:', normalizedEmail);

    // Fetch customer's personal referral code for sharing (not the code they used to sign up)
    const { data: customer, error } = await supabase
      .from('customers')
      .select('id, email, personal_referral_code, qr_code_url, referral_code_used, referral_type, personal_qr_code_url')
      .eq('email', normalizedEmail)
      .single();

    console.log('[CUSTOMER REFERRAL CODE] Query result:', {
      hasCustomer: !!customer,
      hasError: !!error,
      error: error?.message,
      customerData: customer ? {
        id: customer.id,
        email: customer.email,
        personal_referral_code: customer.personal_referral_code,
        qr_code_url: customer.qr_code_url,
        personal_qr_code_url: customer.personal_qr_code_url
      } : null
    });

    if (error || !customer) {
      console.error('[CUSTOMER REFERRAL CODE] Failed to fetch customer:', {
        email: normalizedEmail,
        error: error?.message,
        errorDetails: error
      });
      return NextResponse.json({
        code: null,
        share_url: null,
        qr_code_url: null
      });
    }

    // Use personal_qr_code_url if available, fallback to qr_code_url
    const qrCodeUrl = customer.personal_qr_code_url || customer.qr_code_url;

    // Build the share URL for the customer's personal referral code
    const shareUrl = customer.personal_referral_code
      ? `/c/${customer.personal_referral_code}`
      : null;

    console.log('[CUSTOMER REFERRAL CODE] Retrieved personal referral code:', {
      email: normalizedEmail,
      customerId: customer.id,
      personalReferralCode: customer.personal_referral_code,
      qrCodeUrl: qrCodeUrl,
      shareUrl: shareUrl
    });

    return NextResponse.json({
      code: customer.personal_referral_code,
      share_url: shareUrl,
      qr_code_url: qrCodeUrl,
      // Also include referral_code_used for checkout fallback use case
      referral_code_used: customer.referral_code_used,
      referral_type: customer.referral_type
    });

  } catch (error) {
    console.error('[CUSTOMER REFERRAL CODE] API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
