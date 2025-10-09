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

    // First, try to find partner referral
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

    // If not found as partner referral, try as customer referral
    let customerReferral = null;
    if (referralError || !referral) {
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id, first_name, last_name, email, personal_referral_code')
        .eq('personal_referral_code', referralCode.toUpperCase())
        .single();

      if (customer && !customerError) {
        // Check if customer is trying to use their own referral code
        if (customer.email.toLowerCase() === customerEmail.toLowerCase()) {
          console.log('[REFERRAL] Customer attempting to use their own referral code:', customerEmail);
          return NextResponse.json(
            {
              valid: false,
              error: 'You cannot use your own referral code',
              discount: null
            },
            { status: 200 }
          );
        }
        customerReferral = customer;
      }
    }

    if ((referralError || !referral) && !customerReferral) {
      console.log('[REFERRAL] Referral code not found:', referralCode, 'Errors:', referralError?.message);
      return NextResponse.json(
        {
          valid: false,
          error: 'Referral code not found',
          discount: null
        },
        { status: 200 } // Change to 200 to avoid console errors
      );
    }

    // Check if expired (only for partner referrals, customer referrals don't expire)
    if (referral && new Date(referral.expires_at) < new Date()) {
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
    const { data: existingOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id, referral_code, status')
      .eq('customer_email', customerEmail);

    console.log('[REFERRAL VALIDATION] Customer orders check:', {
      customerEmail,
      existingOrdersCount: existingOrders?.length || 0,
      existingOrders: existingOrders,
      ordersError: ordersError?.message
    });

    // Customer is eligible for referral discount if:
    // 1. They have no orders at all (truly first-time customer), OR
    // 2. They have never completed an order with a referral discount
    const hasCompletedReferralOrder = existingOrders?.some(order =>
      order.referral_code &&
      ['confirmed', 'processing', 'shipped', 'delivered', 'completed'].includes(order.status)
    );

    const isEligibleForDiscount = !hasCompletedReferralOrder;

    console.log('[REFERRAL VALIDATION] Eligibility check:', {
      hasCompletedReferralOrder,
      isEligibleForDiscount,
      ordersWithReferralCode: existingOrders?.filter(o => o.referral_code).length || 0
    });

    // Determine referral type and calculate discount
    const isPartnerReferral = !!referral;
    const isCustomerReferral = !!customerReferral;

    // Calculate potential discount (10% for eligible customers per simplified commission rules)
    let discountAmount = 0;
    let discountPercentage = 0;
    let referralType = '';

    if (isEligibleForDiscount) {
      const subtotal = orderTotal; // Assuming orderTotal is the subtotal (no shipping)
      discountPercentage = 10;
      discountAmount = Math.round(subtotal * 0.10 * 100); // Convert to pence
      referralType = isPartnerReferral ? 'partner' : 'customer';
    }

    // Calculate commission for partner info (10% per simplified commission rules)
    const commissionRate = isEligibleForDiscount && isPartnerReferral ? 10.00 : 0.00;
    const commissionAmount = Math.round(orderTotal * (commissionRate / 100));

    // Prepare referral data based on type
    const referralData = isPartnerReferral
      ? {
          id: referral.id,
          code: referral.referral_code,
          type: 'partner',
          clientName: `${referral.client_first_name || ''} ${referral.client_last_name || ''}`.trim(),
          partner: referral.partners
        }
      : {
          id: customerReferral.id,
          code: customerReferral.personal_referral_code,
          type: 'customer',
          customerName: `${customerReferral.first_name || ''} ${customerReferral.last_name || ''}`.trim(),
          customerEmail: customerReferral.email
        };

    const response = {
      valid: true,
      referral: referralData,
      customer: {
        email: customerEmail,
        isEligibleForDiscount: isEligibleForDiscount,
        hasCompletedReferralOrder: hasCompletedReferralOrder
      },
      discount: {
        eligible: isEligibleForDiscount,
        percentage: discountPercentage,
        amount: discountAmount,
        type: referralType,
        description: isEligibleForDiscount
          ? '10% referral discount!'
          : 'You have already used a referral discount on a previous order'
      },
      commission: {
        rate: commissionRate,
        amount: commissionAmount
      }
    };

    console.log('[REFERRAL VALIDATION] Returning response:', {
      valid: response.valid,
      referralCode: referralCode,
      referralType: response.referral.type,
      discountEligible: response.discount.eligible,
      discountAmount: response.discount.amount,
      discountPercentage: response.discount.percentage
    });

    return NextResponse.json(response);

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