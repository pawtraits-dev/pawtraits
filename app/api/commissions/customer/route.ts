import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const {
      orderId,
      orderAmount,
      referredCustomer,
      referringCustomerId,
      referringCustomerEmail
    } = await request.json();

    console.log('🎁 API: Creating customer referral credit:', {
      orderId,
      orderAmount,
      referringCustomerId,
      referringCustomerEmail
    });

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const creditRate = 10.00; // 10%
    const creditAmount = Math.round(orderAmount * (creditRate / 100));

    const creditData = {
      order_id: orderId,
      order_amount: orderAmount,
      recipient_type: 'customer',
      recipient_id: referringCustomerId,
      recipient_email: referringCustomerEmail,
      referrer_type: 'customer',
      referrer_id: referringCustomerId,
      referral_code: referredCustomer.referral_code_used || null,
      commission_type: 'customer_credit',
      commission_rate: creditRate,
      commission_amount: creditAmount,
      status: 'approved', // Customer credits are auto-approved
      metadata: {
        referred_customer_id: referredCustomer.id,
        referred_customer_email: referredCustomer.email,
        referral_type: referredCustomer.referral_type,
        created_via: 'webhook'
      }
    };

    const { data: credit, error } = await supabase
      .from('commissions')
      .insert(creditData)
      .select()
      .single();

    if (error) {
      console.error('❌ API Error creating customer credit:', error);
      return NextResponse.json({ error: 'Failed to create customer credit' }, { status: 500 });
    }

    console.log('✅ API: Customer credit created:', credit.id, `£${creditAmount/100}`);
    return NextResponse.json(credit);

  } catch (error) {
    console.error('💥 API Error:', error);
    return NextResponse.json({ error: 'Failed to create customer credit' }, { status: 500 });
  }
}