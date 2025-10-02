#!/usr/bin/env tsx

/**
 * Test Commission Flow
 *
 * This script simulates a Stripe webhook payment_intent.succeeded event
 * for customer c-003@atemporal.co.uk to test the new commission tracking system.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function testCommissionFlow() {
  console.log('🧪 Testing Commission Flow for customer c-003@atemporal.co.uk');

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    // First, check if customer exists and has referral setup
    console.log('1. Checking customer referral setup...');

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select(`
        id, email, first_name, last_name, referral_type,
        referrals (
          id, partner_id, referral_code, status,
          partners (id, email, business_name, first_name, last_name)
        )
      `)
      .eq('email', 'c-003@atemporal.co.uk')
      .single();

    if (customerError) {
      console.error('❌ Customer lookup failed:', customerError);
      return;
    }

    console.log('✅ Customer found:', {
      id: customer.id,
      email: customer.email,
      referral_type: customer.referral_type,
      has_referral: !!customer.referrals
    });

    if (customer.referrals) {
      console.log('📋 Referral details:', {
        partner_id: customer.referrals.partner_id,
        referral_code: customer.referrals.referral_code,
        status: customer.referrals.status,
        partner_email: customer.referrals.partners?.email
      });
    }

    // 2. Create a test order
    console.log('2. Creating test order...');

    const testOrder = {
      id: crypto.randomUUID(),
      order_number: `TEST-${Date.now()}`,
      customer_email: customer.email,
      customer_first_name: customer.first_name,
      customer_last_name: customer.last_name,
      subtotal_amount: 4500, // £45.00
      shipping_cost: 500,    // £5.00
      total_amount: 5000,    // £50.00
      currency: 'GBP',
      status: 'pending',
      payment_status: 'pending',
      shipping_first_name: customer.first_name,
      shipping_last_name: customer.last_name,
      shipping_address_line_1: '123 Test Street',
      shipping_city: 'London',
      shipping_postal_code: 'SW1A 1AA',
      shipping_country: 'United Kingdom',
      shipping_country_code: 'GB',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(testOrder)
      .select()
      .single();

    if (orderError) {
      console.error('❌ Order creation failed:', orderError);
      return;
    }

    console.log('✅ Test order created:', {
      id: order.id,
      order_number: order.order_number,
      subtotal_amount: order.subtotal_amount
    });

    // 3. Simulate the webhook payload and call the commission API endpoints
    console.log('3. Testing commission creation...');

    if (customer.referral_type === 'partner' && customer.referrals) {
      console.log('🎯 Creating partner commission...');

      const commissionPayload = {
        orderId: order.id,
        orderAmount: order.subtotal_amount,
        customer: {
          id: customer.id,
          email: customer.email,
          referral_code_used: customer.referrals.referral_code,
          referral_type: customer.referral_type
        },
        partnerId: customer.referrals.partner_id,
        partnerEmail: customer.referrals.partners?.email || ''
      };

      // Test the partner commission API endpoint
      const response = await fetch('http://localhost:3001/api/commissions/partner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(commissionPayload)
      });

      if (response.ok) {
        const commission = await response.json();
        console.log('✅ Partner commission created:', {
          id: commission.id,
          amount: `£${commission.commission_amount / 100}`,
          rate: `${commission.commission_rate}%`,
          status: commission.status
        });
      } else {
        const error = await response.text();
        console.error('❌ Partner commission creation failed:', response.status, error);
      }
    }

    if (customer.referral_type === 'customer') {
      console.log('🎁 Creating customer referral credit...');

      // For customer referrals, we'd need to find who referred them
      // This is a simplified version for testing
      const creditPayload = {
        orderId: order.id,
        orderAmount: order.subtotal_amount,
        referredCustomer: {
          id: customer.id,
          email: customer.email,
          referral_code_used: customer.referrals?.referral_code,
          referral_type: customer.referral_type
        },
        referringCustomerId: customer.id, // Simplified for test
        referringCustomerEmail: customer.email
      };

      const response = await fetch('http://localhost:3001/api/commissions/customer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(creditPayload)
      });

      if (response.ok) {
        const credit = await response.json();
        console.log('✅ Customer credit created:', {
          id: credit.id,
          amount: `£${credit.commission_amount / 100}`,
          rate: `${credit.commission_rate}%`,
          status: credit.status
        });
      } else {
        const error = await response.text();
        console.error('❌ Customer credit creation failed:', response.status, error);
      }
    }

    // 4. Verify the commission was created in the database
    console.log('4. Verifying commission in database...');

    const { data: commissions, error: commissionError } = await supabase
      .from('commissions')
      .select('*')
      .eq('order_id', order.id);

    if (commissionError) {
      console.error('❌ Commission verification failed:', commissionError);
    } else {
      console.log('✅ Commissions found in database:', commissions?.length || 0);
      if (commissions && commissions.length > 0) {
        commissions.forEach(commission => {
          console.log(`  - ${commission.commission_type}: £${commission.commission_amount / 100} (${commission.status})`);
        });
      }
    }

    // 5. Test admin commission API
    console.log('5. Testing admin commission API...');

    const adminResponse = await fetch('http://localhost:3001/api/admin/commissions');
    if (adminResponse.ok) {
      const adminData = await adminResponse.json();
      const testOrderCommissions = adminData.filter((c: any) => c.order_id === order.id);
      console.log('✅ Admin API returned', testOrderCommissions.length, 'commission(s) for test order');
    } else {
      console.error('❌ Admin commission API failed:', adminResponse.status);
    }

    console.log('🎉 Commission flow test completed!');

  } catch (error) {
    console.error('💥 Test failed with error:', error);
  }
}

// Run the test
if (require.main === module) {
  testCommissionFlow().catch(console.error);
}

export { testCommissionFlow };