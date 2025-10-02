import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email parameter is required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    console.log('🔍 Customer lookup API: Searching for customer:', email);

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select(`
        id,
        email,
        referral_type,
        referrer_id,
        referral_code_used,
        referral_discount_applied,
        referral_commission_rate,
        referral_order_id,
        created_at,
        updated_at
      `)
      .eq('email', email)
      .single();

    if (customerError) {
      console.error('❌ Customer lookup error:', customerError);
      if (customerError.code === 'PGRST116') {
        return NextResponse.json({
          error: 'Customer not found',
          customer: null
        }, { status: 404 });
      }
      return NextResponse.json({
        error: 'Database error',
        details: customerError.message
      }, { status: 500 });
    }

    console.log('✅ Customer found:', {
      id: customer.id,
      email: customer.email,
      referral_type: customer.referral_type,
      referrer_id: customer.referrer_id,
      has_referral_data: !!(customer.referral_type && customer.referrer_id)
    });

    return NextResponse.json({
      success: true,
      customer
    });

  } catch (error) {
    console.error('💥 Customer lookup API error:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}