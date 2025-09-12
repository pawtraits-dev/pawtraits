import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function debugCommissions() {
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  console.log('🔍 COMMISSION SYSTEM DEBUG REPORT\n');

  // Check if client_orders table exists and has data
  console.log('1. Checking client_orders table (commission records):');
  const { data: clientOrders, error: clientOrdersError } = await supabase
    .from('client_orders')
    .select('*')
    .limit(10);

  if (clientOrdersError) {
    console.log('❌ Error querying client_orders:', clientOrdersError.message);
    if (clientOrdersError.code === '42P01') {
      console.log('⚠️  client_orders table does not exist!');
    }
  } else {
    console.log(`✅ Found ${clientOrders?.length || 0} commission records in client_orders`);
    if (clientOrders && clientOrders.length > 0) {
      console.log('Sample records:', clientOrders.map(record => ({
        id: record.id?.substring(0, 8),
        client_email: record.client_email,
        partner_id: record.partner_id?.substring(0, 8),
        commission_amount: record.commission_amount,
        commission_paid: record.commission_paid,
        order_type: record.order_type,
        created_at: record.created_at
      })));
    }
  }

  console.log('\n2. Checking recent orders with partner attribution:');
  const { data: partnerOrders, error: partnerOrdersError } = await supabase
    .from('orders')
    .select('id, order_number, order_type, placed_by_partner_id, client_email, client_name, total_amount, created_at')
    .not('placed_by_partner_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);

  if (partnerOrdersError) {
    console.log('❌ Error querying partner orders:', partnerOrdersError.message);
  } else {
    console.log(`✅ Found ${partnerOrders?.length || 0} orders with partner attribution`);
    if (partnerOrders && partnerOrders.length > 0) {
      console.log('Recent partner orders:', partnerOrders.map(order => ({
        id: order.id.substring(0, 8),
        order_number: order.order_number,
        order_type: order.order_type,
        partner_id: order.placed_by_partner_id?.substring(0, 8),
        client_email: order.client_email,
        total_amount: order.total_amount,
        created_at: order.created_at
      })));
    }
  }

  console.log('\n3. Checking referrals table for commission tracking:');
  const { data: referrals, error: referralsError } = await supabase
    .from('referrals')
    .select('id, status, commission_amount, order_value, purchased_at, customer_email, partner_id')
    .eq('status', 'applied')
    .limit(5);

  if (referralsError) {
    console.log('❌ Error querying referrals:', referralsError.message);
  } else {
    console.log(`✅ Found ${referrals?.length || 0} applied referrals`);
    if (referrals && referrals.length > 0) {
      console.log('Applied referrals:', referrals.map(ref => ({
        id: ref.id?.substring(0, 8),
        customer_email: ref.customer_email,
        partner_id: ref.partner_id?.substring(0, 8),
        commission_amount: ref.commission_amount,
        order_value: ref.order_value,
        purchased_at: ref.purchased_at
      })));
    }
  }

  console.log('\n4. Cross-checking: Orders vs Commission Records');
  if (partnerOrders && partnerOrders.length > 0) {
    for (const order of partnerOrders) {
      // Check if this order has a corresponding commission record
      const { data: commissionRecord, error } = await supabase
        .from('client_orders')
        .select('id, commission_amount, commission_rate')
        .eq('order_id', order.id)
        .single();

      console.log(`Order ${order.id.substring(0, 8)} (${order.order_type}):`, 
        commissionRecord 
          ? `✅ Has commission record (${commissionRecord.commission_amount} @ ${commissionRecord.commission_rate}%)`
          : '❌ Missing commission record'
      );
    }
  }

  console.log('\n5. Checking partners table for commission rates:');
  const { data: partners, error: partnersError } = await supabase
    .from('partners')
    .select('id, email, business_name, initial_commission_rate, subsequent_commission_rate')
    .limit(3);

  if (partnersError) {
    console.log('❌ Error querying partners:', partnersError.message);
  } else {
    console.log(`✅ Found ${partners?.length || 0} partners with commission rates`);
    partners?.forEach(partner => {
      console.log(`Partner ${partner.id.substring(0, 8)} (${partner.business_name || partner.email}): Initial ${partner.initial_commission_rate}%, Subsequent ${partner.subsequent_commission_rate}%`);
    });
  }

  console.log('\n📋 COMMISSION SYSTEM STATUS:');
  
  // Summary
  const hasClientOrdersTable = !clientOrdersError || clientOrdersError.code !== '42P01';
  const hasCommissionRecords = clientOrders && clientOrders.length > 0;
  const hasPartnerOrders = partnerOrders && partnerOrders.length > 0;
  const hasPartnerRates = partners && partners.length > 0;

  console.log(`• Client Orders Table: ${hasClientOrdersTable ? '✅ Exists' : '❌ Missing'}`);
  console.log(`• Commission Records: ${hasCommissionRecords ? '✅ Found' : '❌ None'}`);
  console.log(`• Partner Orders: ${hasPartnerOrders ? '✅ Found' : '❌ None'}`);
  console.log(`• Partner Commission Rates: ${hasPartnerRates ? '✅ Configured' : '❌ Missing'}`);

  if (!hasClientOrdersTable) {
    console.log('\n🚨 CRITICAL: client_orders table is missing! Commission records cannot be stored.');
  } else if (!hasCommissionRecords && hasPartnerOrders) {
    console.log('\n⚠️  WARNING: Partner orders exist but no commission records found. Check webhook logic.');
  } else if (hasCommissionRecords) {
    console.log('\n✅ Commission system appears to be working - records exist.');
  }
}

debugCommissions().catch(console.error);