import { serviceClient } from '@/lib/qr/server';

export interface CustomerCreditInput {
  orderId: string;
  orderAmount: number;
  referredCustomer: {
    id: string | null;
    email: string;
    referral_code_used?: string | null;
    referral_type?: string | null;
  };
  referringCustomerId: string;
  referringCustomerEmail: string;
}

/**
 * Creates the 10% customer referral credit for an order and adds it to the
 * referring customer's current_credit_balance (pence).
 *
 * Moved from POST /api/commissions/customer (server-only; uses the service-role client).
 * Returns the created commissions row (with `balance_update_error` when the credit was
 * created but the balance could not be updated). Throws when the credit row itself
 * could not be created - the case where the route used to answer 500.
 */
export async function createCustomerCredit({
  orderId,
  orderAmount,
  referredCustomer,
  referringCustomerId,
  referringCustomerEmail
}: CustomerCreditInput): Promise<any> {
  console.log('🎁 API: Creating customer referral credit:', {
    orderId,
    orderAmount,
    referringCustomerId,
    referringCustomerEmail
  });

  const supabase = serviceClient();

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
    throw new Error('Failed to create customer credit');
  }

  console.log('✅ API: Customer credit created:', credit.id, `£${creditAmount/100}`);

  // Update the referring customer's current_credit_balance (stored in pence)
  const { data: referringCustomer, error: balanceError} = await supabase
    .from('customers')
    .select('id, current_credit_balance, email')
    .eq('id', referringCustomerId)
    .single();

  if (balanceError || !referringCustomer) {
    console.error('❌ API Error fetching referring customer for balance update:', balanceError);
    // Still return success for commission creation, but log the balance update failure
    return {
      ...credit,
      balance_update_error: 'Failed to update credit balance'
    };
  }

  // Add credit amount in pence to existing balance (both are integers in pence)
  const newBalance = (referringCustomer.current_credit_balance || 0) + creditAmount;

  const { error: updateError } = await supabase
    .from('customers')
    .update({ current_credit_balance: newBalance })
    .eq('id', referringCustomerId);

  if (updateError) {
    console.error('❌ API Error updating customer current_credit_balance:', updateError);
    return {
      ...credit,
      balance_update_error: 'Failed to update credit balance'
    };
  }

  console.log('✅ API: Customer current_credit_balance updated:', {
    customerId: referringCustomerId,
    customerEmail: referringCustomer.email,
    previousBalancePence: referringCustomer.current_credit_balance,
    previousBalancePounds: ((referringCustomer.current_credit_balance || 0) / 100).toFixed(2),
    creditEarnedPence: creditAmount,
    creditEarnedPounds: (creditAmount / 100).toFixed(2),
    newBalancePence: newBalance,
    newBalancePounds: (newBalance / 100).toFixed(2)
  });

  return credit;
}
