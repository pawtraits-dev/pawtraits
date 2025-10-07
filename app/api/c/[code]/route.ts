import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    // Use service role key for public QR code access
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { code } = await params;

    if (!code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    // Look up customer by personal_referral_code
    const { data: customerData, error: customerError } = await supabase
      .from('customers')
      .select('id, first_name, last_name, email, personal_referral_code, is_registered')
      .eq('personal_referral_code', code)
      .single();

    if (customerError || !customerData) {
      return NextResponse.json({ error: 'Code not found' }, { status: 404 });
    }

    // Check if customer is registered (active)
    if (!customerData.is_registered) {
      return NextResponse.json({ error: 'Code is not active' }, { status: 410 });
    }

    // Construct response in similar format to partner codes
    const codeData = {
      id: customerData.id,
      code: customerData.personal_referral_code,
      status: 'active',
      customer_id: customerData.id,
      customer: {
        id: customerData.id,
        first_name: customerData.first_name,
        last_name: customerData.last_name,
        email: customerData.email
      },
      share_url: `/c/${customerData.personal_referral_code}`,
      scans_count: 0, // TODO: Implement scan tracking if needed
      referrer_type: 'customer'
    };

    // Increment scan count atomically using RPC function
    const { error: incrementError } = await supabase.rpc('increment_customer_referral_scans', {
      p_customer_id: customerData.id
    });

    if (incrementError) {
      console.error('Failed to increment customer scan count:', incrementError);
      // Continue anyway - this is not critical
    }

    return NextResponse.json(codeData);
  } catch (error) {
    console.error('Customer referral code verification error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
