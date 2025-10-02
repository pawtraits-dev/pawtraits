import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email') || 'c-003@atemporal.co.uk';

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    console.log('🔍 Debug: Checking customer referral status for:', email);

    // Check customer record
    const { data: customers, error: customerError } = await supabase
      .from('customers')
      .select(`
        id, email, referral_type, referrer_id, referral_code_used, referral_order_id,
        referral_discount_applied, referral_commission_rate, referral_applied_at,
        created_at, updated_at
      `)
      .eq('email', email.toLowerCase());

    console.log('Customer lookup result:', { customers, error: customerError });

    // Check for referrals records
    const { data: referrals, error: referralsError } = await supabase
      .from('referrals')
      .select(`
        id, partner_id, customer_id, referral_code, status, created_at,
        partners (id, email, business_name, first_name, last_name)
      `)
      .eq('customer_email', email.toLowerCase());

    console.log('Referrals lookup result:', { referrals, error: referralsError });

    // Check for existing commissions
    const { data: commissions, error: commissionsError } = await supabase
      .from('commissions')
      .select('*')
      .or(`recipient_email.eq.${email.toLowerCase()},metadata->>customer_email.eq.${email.toLowerCase()}`);

    console.log('Commissions lookup result:', { commissions, error: commissionsError });

    return NextResponse.json({
      debug: {
        email,
        timestamp: new Date().toISOString()
      },
      customers: {
        data: customers,
        error: customerError,
        count: customers?.length || 0
      },
      referrals: {
        data: referrals,
        error: referralsError,
        count: referrals?.length || 0
      },
      commissions: {
        data: commissions,
        error: commissionsError,
        count: commissions?.length || 0
      }
    });

  } catch (error) {
    console.error('Debug API error:', error);
    return NextResponse.json({ error: 'Debug failed', details: error }, { status: 500 });
  }
}