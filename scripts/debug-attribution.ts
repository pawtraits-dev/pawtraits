import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function debugAttribution() {
  console.log('='.repeat(80));
  console.log('DEBUG: Partner Attribution Chain for PEUWQLMN (p-011)');
  console.log('='.repeat(80));

  // Step 1: Get partner info
  const { data: partner, error: partnerError } = await supabase
    .from('partners')
    .select('id, email, personal_referral_code, business_name')
    .eq('email', 'p-011@atemporal.co.uk')
    .single();

  if (partnerError || !partner) {
    console.error('Partner not found:', partnerError);
    return;
  }

  console.log('\n📋 Partner Info:');
  console.log(`  ID: ${partner.id}`);
  console.log(`  Email: ${partner.email}`);
  console.log(`  Code: ${partner.personal_referral_code}`);
  console.log(`  Business: ${partner.business_name}`);

  // Step 2: Get direct referrals (Level 1)
  console.log('\n🔍 Level 1: Direct Partner Referrals');
  console.log('  Query: referral_type = PARTNER AND referral_code_used = PEUWQLMN');

  const { data: level1Customers, error: level1Error } = await supabase
    .from('customers')
    .select('id, email, personal_referral_code, referral_type, referral_code_used, referrer_id')
    .eq('referral_type', 'PARTNER')
    .eq('referral_code_used', partner.personal_referral_code);

  if (level1Error) {
    console.error('Error fetching Level 1:', level1Error);
    return;
  }

  console.log(`  Found ${level1Customers?.length || 0} direct referrals:`);
  level1Customers?.forEach(c => {
    console.log(`    - ${c.email} (ID: ${c.id})`);
    console.log(`      Personal Code: ${c.personal_referral_code}`);
    console.log(`      Referrer ID: ${c.referrer_id}`);
  });

  // Step 3: Check c-010 specifically
  console.log('\n🔍 Checking c-010@atemporal.co.uk:');
  const { data: c010, error: c010Error } = await supabase
    .from('customers')
    .select('*')
    .eq('email', 'c-010@atemporal.co.uk')
    .single();

  if (c010Error || !c010) {
    console.error('c-010 not found:', c010Error);
    return;
  }

  console.log(`  ID: ${c010.id}`);
  console.log(`  Personal Code: ${c010.personal_referral_code}`);
  console.log(`  Referral Type: ${c010.referral_type}`);
  console.log(`  Referral Code Used: ${c010.referral_code_used}`);
  console.log(`  Referrer ID: ${c010.referrer_id}`);

  // Step 4: Check c-011 specifically
  console.log('\n🔍 Checking c-011@atemporal.co.uk:');
  const { data: c011, error: c011Error } = await supabase
    .from('customers')
    .select('*')
    .eq('email', 'c-011@atemporal.co.uk')
    .single();

  if (c011Error || !c011) {
    console.error('c-011 not found:', c011Error);
    return;
  }

  console.log(`  ID: ${c011.id}`);
  console.log(`  Personal Code: ${c011.personal_referral_code}`);
  console.log(`  Referral Type: ${c011.referral_type}`);
  console.log(`  Referral Code Used: ${c011.referral_code_used}`);
  console.log(`  Referrer ID: ${c011.referrer_id}`);

  // Step 5: Check if c-011 is linked to c-010
  console.log('\n🔗 Checking Link: c-011 → c-010');
  if (c011.referrer_id === c010.id) {
    console.log(`  ✅ c-011.referrer_id (${c011.referrer_id}) matches c-010.id (${c010.id})`);
  } else {
    console.log(`  ❌ c-011.referrer_id (${c011.referrer_id}) does NOT match c-010.id (${c010.id})`);
  }

  if (c011.referral_type === 'CUSTOMER') {
    console.log(`  ✅ c-011.referral_type is CUSTOMER`);
  } else {
    console.log(`  ❌ c-011.referral_type is ${c011.referral_type} (expected CUSTOMER)`);
  }

  // Step 6: Try to find customers referred by c-010
  console.log('\n🔍 Customers Referred by c-010:');
  console.log(`  Query: referral_type = CUSTOMER AND referrer_id = ${c010.id}`);

  const { data: c010Referrals, error: c010RefError } = await supabase
    .from('customers')
    .select('id, email, personal_referral_code, referral_type, referral_code_used, referrer_id')
    .eq('referral_type', 'CUSTOMER')
    .eq('referrer_id', c010.id);

  if (c010RefError) {
    console.error('Error:', c010RefError);
    return;
  }

  console.log(`  Found ${c010Referrals?.length || 0} customers:`);
  c010Referrals?.forEach(c => {
    console.log(`    - ${c.email} (ID: ${c.id})`);
    console.log(`      Referral Code Used: ${c.referral_code_used}`);
  });

  // Step 7: Call the RPC function
  console.log('\n🔧 Testing RPC Function: get_attributed_customers');
  const { data: rpcResult, error: rpcError } = await supabase
    .rpc('get_attributed_customers', {
      partner_code: partner.personal_referral_code
    });

  if (rpcError) {
    console.error('RPC Error:', rpcError);
    return;
  }

  console.log(`\n📊 RPC Function Results (${rpcResult?.length || 0} customers):`);
  rpcResult?.forEach((customer: any) => {
    console.log(`  Level ${customer.referral_level}: ${customer.customer_email}`);
    console.log(`    Path: ${customer.referral_path}`);
  });

  console.log('\n' + '='.repeat(80));
}

debugAttribution().catch(console.error);
