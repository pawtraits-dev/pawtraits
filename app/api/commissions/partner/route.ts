import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const {
      orderId,
      orderAmount,
      customer,
      partnerId,
      partnerEmail
    } = await request.json();

    console.log('💰 API: Creating partner commission:', {
      orderId,
      orderAmount,
      partnerId,
      partnerEmail
    });

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const commissionRate = 10.00; // 10%
    const commissionAmount = Math.round(orderAmount * (commissionRate / 100));

    const commissionData = {
      order_id: orderId,
      order_amount: orderAmount,
      recipient_type: 'partner',
      recipient_id: partnerId,
      recipient_email: partnerEmail,
      referrer_type: 'partner',
      referrer_id: partnerId,
      referral_code: customer.referral_code_used || null,
      commission_type: 'partner_commission',
      commission_rate: commissionRate,
      commission_amount: commissionAmount,
      status: 'pending',
      metadata: {
        customer_id: customer.id,
        customer_email: customer.email,
        referral_type: customer.referral_type,
        created_via: 'webhook'
      }
    };

    const { data: commission, error } = await supabase
      .from('commissions')
      .insert(commissionData)
      .select()
      .single();

    if (error) {
      console.error('❌ API Error creating partner commission:', error);
      return NextResponse.json({ error: 'Failed to create partner commission' }, { status: 500 });
    }

    console.log('✅ API: Partner commission created:', commission.id, `£${commissionAmount/100}`);
    return NextResponse.json(commission);

  } catch (error) {
    console.error('💥 API Error:', error);
    return NextResponse.json({ error: 'Failed to create partner commission' }, { status: 500 });
  }
}