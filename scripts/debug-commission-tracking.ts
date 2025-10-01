#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function debugCommissionTracking() {
  console.log('🔍 DEBUG: Commission Tracking Analysis');
  console.log('=====================================\n');

  // 1. Check recent orders
  console.log('1. Recent Orders (last 10):');
  const { data: recentOrders, error: ordersError } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (ordersError) {
    console.error('Error fetching orders:', ordersError);
    return;
  }

  console.log(`Found ${recentOrders?.length} recent orders:`);
  recentOrders?.forEach(order => {
    console.log(`  - Order ${order.id}: ${order.customer_email}, ${order.subtotal_amount/100}£, referral: ${order.referral_code || 'none'}`);
  });
  console.log('');

  // 2. Check client_orders (commission records)
  console.log('2. Commission Records (client_orders):');
  const { data: commissionRecords, error: commissionsError } = await supabase
    .from('client_orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (commissionsError) {
    console.error('Error fetching commission records:', commissionsError);
  } else {
    console.log(`Found ${commissionRecords?.length} commission records:`);
    commissionRecords?.forEach(record => {
      console.log(`  - Commission: ${record.commission_amount/100}£, Partner: ${record.partner_id}, Order: ${record.order_id}`);
    });
  }
  console.log('');

  // 3. Check customer_credits
  console.log('3. Customer Credits:');
  const { data: customerCredits, error: creditsError } = await supabase
    .from('customer_credits')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (creditsError) {
    console.error('Error fetching customer credits:', creditsError);
  } else {
    console.log(`Found ${customerCredits?.length} customer credits:`);
    customerCredits?.forEach(credit => {
      console.log(`  - Credit: ${credit.credit_amount/100}£, Customer: ${credit.customer_id}, Order: ${credit.order_id}`);
    });
  }
  console.log('');

  // 4. Check for referral codes and their usage
  console.log('4. Referral Code Analysis:');
  const { data: referralCodes, error: referralError } = await supabase
    .from('referrals')
    .select(`
      referral_code,
      partners (
        first_name,
        last_name,
        business_name
      )
    `)
    .limit(5);

  if (referralError) {
    console.error('Error fetching referrals:', referralError);
  } else {
    console.log(`Active partner referral codes:`);
    referralCodes?.forEach(ref => {
      console.log(`  - Code: ${ref.referral_code}, Partner: ${ref.partners?.business_name || 'Unknown'}`);
    });
  }
  console.log('');

  // 5. Check customer referral codes
  const { data: customerReferrals, error: custRefError } = await supabase
    .from('customers')
    .select('personal_referral_code, first_name, last_name, email')
    .not('personal_referral_code', 'is', null)
    .limit(5);

  if (custRefError) {
    console.error('Error fetching customer referrals:', custRefError);
  } else {
    console.log(`Customer referral codes:`);
    customerReferrals?.forEach(cust => {
      console.log(`  - Code: ${cust.personal_referral_code}, Customer: ${cust.first_name} ${cust.last_name}`);
    });
  }
  console.log('');

  // 6. Check specific test customer orders
  console.log('6. Test Customer c-003@atemporal.co.uk Analysis:');
  const testCustomerEmail = 'c-003@atemporal.co.uk';

  const { data: testOrders } = await supabase
    .from('orders')
    .select('*')
    .eq('customer_email', testCustomerEmail)
    .order('created_at', { ascending: false });

  console.log(`Orders for ${testCustomerEmail}:`);
  testOrders?.forEach(order => {
    console.log(`  - Order ${order.id}: ${order.subtotal_amount/100}£, status: ${order.status}, referral: ${order.referral_code || 'none'}, created: ${order.created_at}`);
  });

  // Check if there are commission records for these orders
  if (testOrders && testOrders.length > 0) {
    const testOrderIds = testOrders.map(o => o.id);
    const { data: testCommissions } = await supabase
      .from('client_orders')
      .select('*')
      .in('order_id', testOrderIds);

    console.log(`Commission records for test customer orders:`);
    if (!testCommissions || testCommissions.length === 0) {
      console.log('  ❌ NO commission records found for test customer orders!');
    } else {
      testCommissions.forEach(comm => {
        console.log(`  - Commission: ${comm.commission_amount/100}£, Order: ${comm.order_id}`);
      });
    }
  }
  console.log('');

  // 7. Check webhook processing status
  console.log('7. Webhook Processing Check:');
  console.log('Next steps to debug:');
  console.log('- Check if orders have referral_code populated');
  console.log('- Verify payment metadata includes referral information');
  console.log('- Test webhook endpoint directly');
  console.log('- Check Stripe webhook logs');
}

debugCommissionTracking().catch(console.error);