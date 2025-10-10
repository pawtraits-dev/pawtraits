import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function fixCustomerReferrerIds() {
  console.log('='.repeat(80));
  console.log('FIXING CUSTOMER REFERRER IDS');
  console.log('='.repeat(80));
  console.log('\nFor CUSTOMER referrals, referrer_id should be customers.id');
  console.log('(not user_profiles.id)\n');

  // Get all customers with referral_type = CUSTOMER
  const { data: customersWithCustomerReferrals, error } = await supabase
    .from('customers')
    .select('id, email, referrer_id, referral_type, referral_code_used')
    .eq('referral_type', 'CUSTOMER');

  if (error) {
    console.error('Error fetching customers:', error);
    return;
  }

  console.log(`Found ${customersWithCustomerReferrals?.length || 0} customers with CUSTOMER referrals\n`);

  let fixedCount = 0;
  let alreadyCorrect = 0;
  let notFoundCount = 0;

  for (const customer of customersWithCustomerReferrals || []) {
    console.log(`\nChecking ${customer.email}:`);
    console.log(`  Current referrer_id: ${customer.referrer_id}`);
    console.log(`  Used code: ${customer.referral_code_used}`);

    // Find the referring customer by their personal_referral_code
    const { data: referringCustomer } = await supabase
      .from('customers')
      .select('id, email, personal_referral_code')
      .eq('personal_referral_code', customer.referral_code_used)
      .maybeSingle();

    if (!referringCustomer) {
      console.log(`  ⚠️  Could not find referring customer with code: ${customer.referral_code_used}`);
      notFoundCount++;
      continue;
    }

    console.log(`  Found referring customer: ${referringCustomer.email} (ID: ${referringCustomer.id})`);

    if (customer.referrer_id === referringCustomer.id) {
      console.log(`  ✅ Already correct`);
      alreadyCorrect++;
      continue;
    }

    // Update the referrer_id
    const { error: updateError } = await supabase
      .from('customers')
      .update({ referrer_id: referringCustomer.id })
      .eq('id', customer.id);

    if (updateError) {
      console.error(`  ❌ Failed to update: ${updateError.message}`);
    } else {
      console.log(`  ✅ FIXED: Changed referrer_id from ${customer.referrer_id} to ${referringCustomer.id}`);
      fixedCount++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY:');
  console.log(`  Total checked: ${customersWithCustomerReferrals?.length || 0}`);
  console.log(`  Already correct: ${alreadyCorrect}`);
  console.log(`  Fixed: ${fixedCount}`);
  console.log(`  Not found: ${notFoundCount}`);
  console.log('='.repeat(80));
}

fixCustomerReferrerIds().catch(console.error);
