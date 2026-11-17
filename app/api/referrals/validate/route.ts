import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getRequester } from '@/lib/guest/access';
import { referralRates } from '@/lib/app-settings';
import { rateFraction, formatPct } from '@/lib/referrals/rates';
import { customerReferralEligibility, eligibilityMessage } from '@/lib/referrals/eligibility';

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

    // Not a partner code: a customer's personal code. One shared rule (lib/referrals/eligibility.ts): the friend
    // must be signed in as this email, new to Pawtraits, and not using their own code. The rate is an admin setting.
    if (referralError || !referral) {
      const { user } = await getRequester(request);
      const rates = await referralRates();
      const pct = formatPct(rates.friendPct);
      const check = await customerReferralEligibility(referralCode, customerEmail, user?.email?.toLowerCase() ?? null);
      const message = eligibilityMessage(check.reason, pct);
      if (check.reason === 'not_found' || check.reason === 'own_code') {
        return NextResponse.json({ valid: false, eligible: false, reason: check.reason, message, error: message, discount: null }, { status: 200 });
      }
      if (!check.eligible) {
        return NextResponse.json({
          valid: true, eligible: false, reason: check.reason, message,
          referral: { type: 'customer', code: String(referralCode).toUpperCase() },
          customer: { email: customerEmail, isEligibleForDiscount: false, hasCompletedReferralOrder: check.reason === 'not_new' },
          discount: { eligible: false, percentage: 0, amount: 0, type: '', description: message },
          commission: { rate: 0, amount: 0 }
        });
      }
      const { data: owner } = await supabase.from('customers').select('id, first_name, last_name, email, personal_referral_code').eq('id', check.ownerCustomerId!).maybeSingle();
      // orderTotal is the subtotal in pounds (before delivery); the amount is in pence
      const amount = Math.round(orderTotal * rateFraction(rates.friendPct) * 100);
      return NextResponse.json({
        valid: true, eligible: true, reason: 'ok', message: `${pct} off your first order.`,
        referral: {
          id: owner?.id ?? check.ownerCustomerId,
          code: owner?.personal_referral_code ?? String(referralCode).toUpperCase(),
          type: 'customer',
          customerName: `${owner?.first_name || ''} ${owner?.last_name || ''}`.trim(),
          customerEmail: owner?.email
        },
        customer: { email: customerEmail, isEligibleForDiscount: true, hasCompletedReferralOrder: false },
        discount: { eligible: true, percentage: rates.friendPct, amount, type: 'customer', description: `${pct} off your first order.` },
        commission: { rate: 0, amount: 0 }
      });
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
    // NOTE: We check both referral_code and discount_amount > 0 for backward compatibility
    const { data: existingOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id, referral_code, discount_amount, status')
      .eq('customer_email', customerEmail);

    console.log('[REFERRAL VALIDATION] Customer orders check:', {
      existingOrdersCount: existingOrders?.length || 0,
      ordersError: ordersError?.message
    });

    // Customer is eligible for referral discount if:
    // 1. They have no orders at all (truly first-time customer), OR
    // 2. They have never completed an order with a referral discount (referral_code present OR discount_amount > 0)
    const hasCompletedReferralOrder = existingOrders?.some(order =>
      (order.referral_code || (order.discount_amount && order.discount_amount > 0)) &&
      ['confirmed', 'processing', 'shipped', 'delivered', 'completed'].includes(order.status)
    );

    const isEligibleForDiscount = !hasCompletedReferralOrder;

    console.log('[REFERRAL VALIDATION] Eligibility check:', {
      hasCompletedReferralOrder,
      isEligibleForDiscount,
      ordersWithReferralCode: existingOrders?.filter(o => o.referral_code).length || 0,
      ordersWithDiscount: existingOrders?.filter(o => o.discount_amount && o.discount_amount > 0).length || 0
    });

    // From here on the code is a PARTNER code (customer codes returned above): behaviour unchanged
    const isPartnerReferral = true;

    // Calculate potential discount (10% for partner codes per simplified commission rules)
    let discountAmount = 0;
    let discountPercentage = 0;
    let referralType = '';

    if (isEligibleForDiscount) {
      const subtotal = orderTotal; // Assuming orderTotal is the subtotal (no shipping)
      discountPercentage = 10;
      discountAmount = Math.round(subtotal * 0.10 * 100); // Convert to pence
      referralType = 'partner';
    }

    // Calculate commission for partner info (10% per simplified commission rules)
    const commissionRate = isEligibleForDiscount && isPartnerReferral ? 10.00 : 0.00;
    const commissionAmount = Math.round(orderTotal * (commissionRate / 100));

    const referralData = {
      id: referral.id,
      code: referral.referral_code,
      type: 'partner',
      clientName: `${referral.client_first_name || ''} ${referral.client_last_name || ''}`.trim(),
      partner: referral.partners
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