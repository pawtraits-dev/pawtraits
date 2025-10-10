import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function checkReferrerIdLogic() {
  console.log('Checking referrer_id logic for c-010 → c-011 chain\n');

  // Get c-010's data
  const { data: c010Customer } = await supabase
    .from('customers')
    .select('id, email, personal_referral_code')
    .eq('email', 'c-010@atemporal.co.uk')
    .single();

  console.log('c-010 Customer Record:');
  console.log(`  customer.id: ${c010Customer?.id}`);
  console.log(`  personal_referral_code: ${c010Customer?.personal_referral_code}`);

  // Get c-010's user_profile
  const { data: c010Profile } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('email', 'c-010@atemporal.co.uk')
    .maybeSingle();

  console.log(`  user_profile.id: ${c010Profile?.id || 'NOT FOUND'}\n`);

  // What would the API return for c-010's code?
  console.log('What API would return when verifying CUSTVAK05AZN:');
  console.log(`  referrer.id would be: ${c010Profile?.id || c010Customer?.id}`);
  console.log(`  (user_profile.id if exists, otherwise customer.id)\n`);

  // Get c-011's referrer_id
  const { data: c011 } = await supabase
    .from('customers')
    .select('id, email, referrer_id, referral_type, referral_code_used')
    .eq('email', 'c-011@atemporal.co.uk')
    .single();

  console.log('c-011 Customer Record:');
  console.log(`  customer.id: ${c011?.id}`);
  console.log(`  referrer_id: ${c011?.referrer_id}`);
  console.log(`  referral_code_used: ${c011?.referral_code_used}`);
  console.log(`  referral_type: ${c011?.referral_type}\n`);

  // Check if referrer_id matches
  console.log('Matching Analysis:');
  if (c011?.referrer_id === c010Profile?.id) {
    console.log(`  ✅ c-011.referrer_id matches c-010.user_profile.id`);
  } else if (c011?.referrer_id === c010Customer?.id) {
    console.log(`  ✅ c-011.referrer_id matches c-010.customer.id`);
  } else {
    console.log(`  ❌ c-011.referrer_id (${c011?.referrer_id}) matches NEITHER:`);
    console.log(`     - c-010.user_profile.id: ${c010Profile?.id || 'N/A'}`);
    console.log(`     - c-010.customer.id: ${c010Customer?.id}`);
  }

  console.log('\nRECOMMENDATION:');
  console.log('  For CUSTOMER referrals, referrer_id should ALWAYS be customers.id');
  console.log('  For PARTNER referrals, referrer_id should be partners.id (or user_profiles.id)');
  console.log('  The SQL function should join on customers.id for customer-to-customer chains');
}

checkReferrerIdLogic().catch(console.error);
