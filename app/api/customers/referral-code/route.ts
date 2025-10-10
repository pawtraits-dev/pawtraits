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

    // Fetch customer's referral_code_used field
    const { data: customer, error } = await supabase
      .from('customers')
      .select('id, email, referral_code_used, referral_type')
      .eq('email', customerEmail.toLowerCase().trim())
      .single();

    if (error || !customer) {
      console.error('[CUSTOMER REFERRAL CODE] Failed to fetch customer:', {
        email: customerEmail,
        error: error?.message
      });
      return NextResponse.json({
        referral_code_used: null,
        referral_type: null
      });
    }

    console.log('[CUSTOMER REFERRAL CODE] Retrieved referral code:', {
      email: customerEmail,
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
