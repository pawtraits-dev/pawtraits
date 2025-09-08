import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { referralCode, customerEmail, orderTotal } = await request.json();

    if (!referralCode || !customerEmail || !orderTotal) {
      return NextResponse.json(
        { error: 'Referral code, customer email, and order total are required' },
        { status: 400 }
      );
    }

    // Get referral details
    const { data: referral, error: referralError } = await supabase
      .from('referrals')
      .select(`
        *,
        partners (
          first_name,
          last_name,
          business_name,
          business_type
        )
      `)
      .eq('referral_code', referralCode.toUpperCase())
      .single();

    if (referralError || !referral) {
      console.log('[REFERRAL] Referral code not found:', referralCode, 'Error:', referralError?.message);
      return NextResponse.json(
        { 
          valid: false,
          error: 'Referral code not found',
          discount: null
        },
        { status: 200 } // Change to 200 to avoid console errors
      );
    }

    // Check if expired
    if (new Date(referral.expires_at) < new Date()) {
      return NextResponse.json(
        { 
          valid: false,
          error: 'Referral code has expired',
          discount: null
        },
        { status: 410 }
      );
    }

    // Check if this customer has existing orders that used referral discounts
    const { data: existingOrders } = await supabase
      .from('orders')
      .select('id, referral_code, status')
      .eq('customer_email', customerEmail);

    // Customer is eligible for referral discount if:
    // 1. They have no orders at all (truly first-time customer), OR
    // 2. They have never completed an order with a referral discount
    const hasCompletedReferralOrder = existingOrders?.some(order => 
      order.referral_code && 
      ['confirmed', 'processing', 'shipped', 'delivered', 'completed'].includes(order.status)
    );
    
    const isEligibleForDiscount = !hasCompletedReferralOrder;

    // Calculate potential discount (20% for eligible customers)
    let discountAmount = 0;
    let discountPercentage = 0;
    
    if (isEligibleForDiscount) {
      const subtotal = orderTotal; // Assuming orderTotal is the subtotal (no shipping)
      discountPercentage = 20;
      discountAmount = Math.round(subtotal * 0.20 * 100); // Convert to pence
    }

    // Calculate commission for partner info
    const commissionRate = isEligibleForDiscount ? 20.00 : 5.00;
    const commissionAmount = Math.round(orderTotal * (commissionRate / 100));

    return NextResponse.json({
      valid: true,
      referral: {
        id: referral.id,
        code: referral.referral_code,
        clientName: `${referral.client_first_name || ''} ${referral.client_last_name || ''}`.trim(),
        partner: referral.partners
      },
      customer: {
        email: customerEmail,
        isEligibleForDiscount: isEligibleForDiscount,
        hasCompletedReferralOrder: hasCompletedReferralOrder
      },
      discount: {
        eligible: isEligibleForDiscount,
        percentage: discountPercentage,
        amount: discountAmount,
        description: isEligibleForDiscount 
          ? '20% referral discount!' 
          : 'You have already used a referral discount on a previous order'
      },
      commission: {
        rate: commissionRate,
        amount: commissionAmount
      }
    });

  } catch (error) {
    console.error('Error validating referral code:', error);
    return NextResponse.json(
      { 
        valid: false,
        error: 'Failed to validate referral code',
        discount: null
      },
      { status: 500 }
    );
  }
}