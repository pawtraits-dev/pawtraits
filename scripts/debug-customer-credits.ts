import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function debugCustomerCredits() {
  console.log('🔍 Debugging Customer Credit System\n');

  // Find c-016 and c-017
  console.log('📋 Looking for c-016 and c-017...\n');

  const { data: customers, error: customersError } = await supabase
    .from('customers')
    .select('*')
    .or('email.ilike.%c-016%,email.ilike.%c-017%')
    .order('created_at', { ascending: true });

  if (customersError) {
    console.error('❌ Error fetching customers:', customersError);
    return;
  }

  if (!customers || customers.length === 0) {
    console.log('❌ No customers found matching c-016 or c-017');
    return;
  }

  console.log(`✅ Found ${customers.length} customers:\n`);
  customers.forEach((customer: any) => {
    console.log(`Customer: ${customer.email}`);
    console.log(`  ID: ${customer.id}`);
    console.log(`  Referral Type: ${customer.referral_type || 'NONE'}`);
    console.log(`  Referrer ID: ${customer.referrer_id || 'NONE'}`);
    console.log(`  Referral Code Used: ${customer.referral_code_used || 'NONE'}`);
    console.log(`  Current Credit Balance: ${customer.current_credit_balance || 0} pence (£${((customer.current_credit_balance || 0) / 100).toFixed(2)})`);
    console.log(`  Created: ${customer.created_at}\n`);
  });

  // Check for orders from these customers
  console.log('📦 Checking orders from these customers...\n');

  for (const customer of customers) {
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .eq('customer_email', customer.email)
      .order('created_at', { ascending: false });

    if (ordersError) {
      console.error(`❌ Error fetching orders for ${customer.email}:`, ordersError);
      continue;
    }

    if (!orders || orders.length === 0) {
      console.log(`  No orders found for ${customer.email}\n`);
      continue;
    }

    console.log(`  ✅ Found ${orders.length} order(s) for ${customer.email}:`);
    orders.forEach((order: any) => {
      console.log(`    Order: ${order.order_number}`);
      console.log(`      ID: ${order.id}`);
      console.log(`      Subtotal: ${order.subtotal_amount} pence (£${(order.subtotal_amount / 100).toFixed(2)})`);
      console.log(`      Status: ${order.status}`);
      console.log(`      Created: ${order.created_at}`);
    });
    console.log('');
  }

  // Check for commissions created for these customers
  console.log('💰 Checking commissions records...\n');

  const customerIds = customers.map((c: any) => c.id);

  const { data: commissions, error: commissionsError } = await supabase
    .from('commissions')
    .select('*')
    .in('recipient_id', customerIds)
    .eq('commission_type', 'customer_credit');

  if (commissionsError) {
    console.error('❌ Error fetching commissions:', commissionsError);
    return;
  }

  if (!commissions || commissions.length === 0) {
    console.log('❌ No customer credit commissions found!');
    console.log('\n🔍 DIAGNOSIS:');
    console.log('Credits are not being created. Check:');
    console.log('1. Did c-017 complete an order?');
    console.log('2. Does c-017 have referral_type = "CUSTOMER"?');
    console.log('3. Does c-017 have referrer_id pointing to c-016?');
    console.log('4. Did the Stripe webhook fire successfully?');
    console.log('5. Check webhook logs for "Creating customer credit" messages\n');
    return;
  }

  console.log(`✅ Found ${commissions.length} customer credit commission(s):\n`);
  commissions.forEach((comm: any) => {
    console.log(`Commission ID: ${comm.id}`);
    console.log(`  Recipient ID: ${comm.recipient_id}`);
    console.log(`  Recipient Email: ${comm.recipient_email}`);
    console.log(`  Order ID: ${comm.order_id}`);
    console.log(`  Order Amount: ${comm.order_amount} pence (£${(comm.order_amount / 100).toFixed(2)})`);
    console.log(`  Commission Amount: ${comm.commission_amount} pence (£${(comm.commission_amount / 100).toFixed(2)})`);
    console.log(`  Status: ${comm.status}`);
    console.log(`  Metadata:`, JSON.stringify(comm.metadata, null, 2));
    console.log(`  Created: ${comm.created_at}\n`);
  });
}

debugCustomerCredits().catch(console.error);
