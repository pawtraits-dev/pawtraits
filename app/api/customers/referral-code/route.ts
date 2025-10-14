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

    // Fetch customer's referral codes (both personal and the one they used)
    const { data: customer, error } = await supabase
      .from('customers')
      .select('id, email, personal_referral_code, referral_code_used, referral_type')
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
        referral_code_used: customer.referral_code_used,
        referral_type: customer.referral_type
      } : null
    });

    if (error || !customer) {
      console.error('[CUSTOMER REFERRAL CODE] Failed to fetch customer:', {
        email: normalizedEmail,
        error: error?.message,
        errorDetails: error
      });
      return NextResponse.json({
        referral_code_used: null,
        referral_type: null
      });
    }

    console.log('[CUSTOMER REFERRAL CODE] Retrieved referral codes:', {
      email: normalizedEmail,
      customerId: customer.id,
      referralCodeUsed: customer.referral_code_used,
      referralType: customer.referral_type
    });

    return NextResponse.json({
      referral_code_used: customer.referral_code_used,
      referral_type: customer.referral_type
    });

  } catch (error) {
    console.error('[CUSTOMER REFERRAL CODE] API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
