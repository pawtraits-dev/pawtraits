#!/usr/bin/env node

/**
 * Script to fix missing order links for referrals
 * This script finds referrals that should be linked to orders and updates them
 * with the correct order information and commission data
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!serviceRoleKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function findUnlinkedReferrals() {
  console.log('🔍 Finding referrals with missing order links...');
  
  const { data: referrals, error } = await supabase
    .from('referrals')
    .select(`
      id,
      referral_code,
      client_email,
      status,
      order_id,
      partner_id,
      commission_rate,
      created_at
    `)
    .is('order_id', null)
    .in('status', ['invited', 'accessed', 'accepted']);

  if (error) {
    console.error('❌ Error fetching referrals:', error);
    return [];
  }

  console.log(`📊 Found ${referrals.length} referrals with null order_id`);
  return referrals;
}

async function findMatchingOrders(referrals) {
  console.log('🔍 Finding matching orders for referrals...');
  
  const matches = [];
  
  for (const referral of referrals) {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, order_number, customer_email, total_amount, shipping_amount, subtotal_amount, created_at')
      .eq('customer_email', referral.client_email)
      .eq('status', 'confirmed')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error(`❌ Error fetching orders for ${referral.client_email}:`, error);
      continue;
    }

    if (orders && orders.length > 0) {
      const order = orders[0];
      
      // Check if this was the customer's first order
      const { data: previousOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('customer_email', referral.client_email)
        .lt('created_at', order.created_at)
        .limit(1);

      const isFirstOrder = !previousOrders || previousOrders.length === 0;
      const commissionRate = isFirstOrder ? 20.00 : 5.00;
      const commissionAmount = Math.round(order.subtotal_amount * (commissionRate / 100));
      const discountAmount = isFirstOrder ? Math.round(order.subtotal_amount * 0.20) : 0;

      matches.push({
        referral,
        order,
        isFirstOrder,
        commissionRate,
        commissionAmount,
        discountAmount
      });
    }
  }

  console.log(`📊 Found ${matches.length} referral-order matches`);
  return matches;
}

async function updateReferralRecord(match) {
  const { referral, order, isFirstOrder, commissionRate, commissionAmount, discountAmount } = match;
  
  console.log(`📝 Updating referral ${referral.referral_code} -> order ${order.order_number}`);
  
  const { data, error } = await supabase
    .from('referrals')
    .update({
      status: 'applied',
      order_id: order.id,
      order_value: order.subtotal_amount,
      discount_amount: discountAmount,
      commission_amount: commissionAmount,
      purchased_at: order.created_at,
      updated_at: new Date().toISOString()
    })
    .eq('id', referral.id)
    .select();

  if (error) {
    console.error(`❌ Error updating referral ${referral.referral_code}:`, error);
    return false;
  }

  console.log(`✅ Updated referral ${referral.referral_code}`);
  return true;
}

async function createClientOrderRecord(match) {
  const { referral, order, isFirstOrder, commissionRate, commissionAmount, discountAmount } = match;
  
  // Check if client_orders record already exists
  const { data: existing } = await supabase
    .from('client_orders')
    .select('id')
    .eq('referral_id', referral.id)
    .eq('client_email', referral.client_email)
    .limit(1);

  if (existing && existing.length > 0) {
    console.log(`ℹ️  Client order record already exists for referral ${referral.referral_code}`);
    return true;
  }

  console.log(`📝 Creating client_orders record for referral ${referral.referral_code}`);

  const { data, error } = await supabase
    .from('client_orders')
    .insert({
      client_email: referral.client_email,
      referral_id: referral.id,
      partner_id: referral.partner_id,
      order_value: order.subtotal_amount,
      discount_applied: discountAmount,
      is_initial_order: isFirstOrder,
      commission_rate: commissionRate,
      commission_amount: commissionAmount,
      commission_paid: false,
      order_items: [],
      order_status: 'completed',
      created_at: order.created_at,
      updated_at: new Date().toISOString()
    });

  if (error) {
    console.error(`❌ Error creating client_orders record for ${referral.referral_code}:`, error);
    return false;
  }

  console.log(`✅ Created client_orders record for referral ${referral.referral_code}`);
  return true;
}

async function generateSummary() {
  console.log('\n📊 SUMMARY REPORT');
  console.log('=================');

  // Total referrals with orders linked
  const { data: linkedReferrals } = await supabase
    .from('referrals')
    .select('id')
    .not('order_id', 'is', null);

  console.log(`📈 Total referrals with orders linked: ${linkedReferrals?.length || 0}`);

  // Total applied referrals
  const { data: appliedReferrals } = await supabase
    .from('referrals')
    .select('id')
    .eq('status', 'applied');

  console.log(`📈 Total applied referrals: ${appliedReferrals?.length || 0}`);

  // Total commission tracking records
  const { data: clientOrders } = await supabase
    .from('client_orders')
    .select('id, commission_amount');

  const totalCommission = clientOrders?.reduce((sum, co) => sum + (co.commission_amount || 0), 0) || 0;
  
  console.log(`📈 Total client_orders records: ${clientOrders?.length || 0}`);
  console.log(`💰 Total commission amount: £${(totalCommission / 100).toFixed(2)} (${totalCommission} pence)`);

  // Recently updated referrals
  const { data: recentlyUpdated } = await supabase
    .from('referrals')
    .select(`
      referral_code,
      client_email,
      status,
      order_value,
      commission_amount,
      commission_rate,
      updated_at
    `)
    .gte('updated_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
    .order('updated_at', { ascending: false });

  if (recentlyUpdated && recentlyUpdated.length > 0) {
    console.log('\n🕒 Recently updated referrals:');
    recentlyUpdated.forEach(ref => {
      console.log(`   ${ref.referral_code} - ${ref.client_email} - £${((ref.commission_amount || 0) / 100).toFixed(2)} commission`);
    });
  }
}

async function main() {
  try {
    console.log('🚀 Starting referral-order link fix script');
    console.log('==========================================\n');

    // Step 1: Find unlinked referrals
    const unlinkedReferrals = await findUnlinkedReferrals();
    
    if (unlinkedReferrals.length === 0) {
      console.log('✅ No referrals need fixing!');
      await generateSummary();
      return;
    }

    // Step 2: Find matching orders
    const matches = await findMatchingOrders(unlinkedReferrals);
    
    if (matches.length === 0) {
      console.log('ℹ️  No matching orders found for unlinked referrals');
      await generateSummary();
      return;
    }

    console.log(`\n🔧 Processing ${matches.length} referral-order matches...\n`);

    // Step 3: Update referral records
    let successCount = 0;
    for (const match of matches) {
      const referralUpdated = await updateReferralRecord(match);
      const clientOrderCreated = await createClientOrderRecord(match);
      
      if (referralUpdated && clientOrderCreated) {
        successCount++;
      }
    }

    console.log(`\n✅ Successfully processed ${successCount}/${matches.length} referral-order links`);

    // Step 4: Generate summary report
    await generateSummary();

  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main };