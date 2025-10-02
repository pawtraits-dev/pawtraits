// New Commission Tracking Functions
// These replace the problematic client_orders approach

import { SupabaseClient } from '@supabase/supabase-js';

export async function createPartnerCommission(
  supabase: SupabaseClient,
  orderId: string,
  orderAmount: number,
  customer: any,
  partnerId: string,
  partnerEmail: string
) {
  console.log('💰 Creating partner commission:', {
    orderId,
    orderAmount,
    partnerId,
    partnerEmail
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
    console.error('❌ Error creating partner commission:', error);
    throw error;
  }

  console.log('✅ Partner commission created:', commission.id, `£${commissionAmount/100}`);
  return commission;
}

export async function createCustomerCredit(
  supabase: SupabaseClient,
  orderId: string,
  orderAmount: number,
  referredCustomer: any,
  referringCustomerId: string,
  referringCustomerEmail: string
) {
  console.log('🎁 Creating customer referral credit:', {
    orderId,
    orderAmount,
    referringCustomerId,
    referringCustomerEmail
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
    console.error('❌ Error creating customer credit:', error);
    throw error;
  }

  console.log('✅ Customer credit created:', credit.id, `£${creditAmount/100}`);
  return credit;
}

export async function getPartnerCommissions(
  supabase: SupabaseClient,
  partnerId: string
) {
  const { data: commissions, error } = await supabase
    .from('commissions')
    .select('*')
    .eq('recipient_type', 'partner')
    .eq('recipient_id', partnerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching partner commissions:', error);
    return { commissions: [], error };
  }

  const summary = {
    total_commissions: commissions.reduce((sum, c) => sum + c.commission_amount, 0),
    pending_commissions: commissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.commission_amount, 0),
    paid_commissions: commissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.commission_amount, 0),
    total_orders: commissions.length,
    commission_records: commissions
  };

  return { commissions: summary, error: null };
}

export async function getCustomerCredits(
  supabase: SupabaseClient,
  customerId: string
) {
  const { data: credits, error } = await supabase
    .from('commissions')
    .select('*')
    .eq('recipient_type', 'customer')
    .eq('recipient_id', customerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching customer credits:', error);
    return { credits: [], error };
  }

  const summary = {
    total_credits: credits.reduce((sum, c) => sum + c.commission_amount, 0),
    available_credits: credits.filter(c => c.status === 'approved').reduce((sum, c) => sum + c.commission_amount, 0),
    used_credits: credits.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.commission_amount, 0),
    credit_records: credits
  };

  return { credits: summary, error: null };
}