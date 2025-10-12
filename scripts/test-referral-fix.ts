import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BASE_URL = 'http://localhost:3001';
const PASSWORD = '!@£QWE123qwe';
const PARTNER_CODE = 'TESTCODE010';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function createCustomer(email: string, firstName: string, lastName: string, referralCode?: string) {
  console.log(`\nCreating ${email}...`);
  if (referralCode) {
    console.log(`  Using referral code: ${referralCode}`);
  }
  
  const response = await fetch(`${BASE_URL}/api/auth/signup/customer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: PASSWORD,
      firstName,
      lastName,
      referralCode
    })
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error(`❌ Failed: ${data.error}`);
    return null;
  }

  // Get customer details from database
  const { data: customerData } = await supabase
    .from('customers')
    .select('id, personal_referral_code, referral_type, referrer_id, referral_code_used')
    .eq('id', data.user.customerId)
    .single();

  const code = customerData?.personal_referral_code;
  console.log(`✅ Created ${email}`);
  console.log(`   Customer ID: ${customerData?.id}`);
  console.log(`   Personal code: ${code}`);
  console.log(`   Referral type: ${customerData?.referral_type}`);
  console.log(`   Referrer ID: ${customerData?.referrer_id}`);
  console.log(`   Code used: ${customerData?.referral_code_used}`);
  
  return {
    customerId: customerData?.id,
    personalCode: code,
    referralType: customerData?.referral_type,
    referrerId: customerData?.referrer_id
  };
}

async function main() {
  console.log('Testing referral fix with c-016, c-017, c-018...\n');
  console.log('Expected behavior:');
  console.log('  c-016: PARTNER referral, referrer_id = p-020 ID');
  console.log('  c-017: CUSTOMER referral, referrer_id = c-016 ID');
  console.log('  c-018: CUSTOMER referral, referrer_id = c-017 ID');
  console.log('═'.repeat(60));

  // Get partner p-020's ID for verification
  const { data: partner } = await supabase
    .from('partners')
    .select('id')
    .eq('email', 'p-020@atemporal.co.uk')
    .single();

  console.log(`\nPartner p-020 ID: ${partner?.id}`);
  console.log('═'.repeat(60));

  // Create c-016 with partner code
  const c016 = await createCustomer('c-016@atemporal.co.uk', 'Customer', 'Sixteen', PARTNER_CODE);
  
  if (!c016) {
    console.error('\n❌ Failed to create c-016, stopping test');
    return;
  }

  // Verify c-016
  console.log('\n🔍 Verification for c-016:');
  if (c016.referralType === 'PARTNER' && c016.referrerId === partner?.id) {
    console.log('  ✅ PASS: Correct referral type and referrer ID');
  } else {
    console.log('  ❌ FAIL: Expected PARTNER type with referrer_id=' + partner?.id);
    console.log('           Got: ' + c016.referralType + ' with referrer_id=' + c016.referrerId);
  }

  // Create c-017 with c-016's code
  const c017 = await createCustomer('c-017@atemporal.co.uk', 'Customer', 'Seventeen', c016.personalCode || undefined);

  if (!c017) {
    console.error('\n❌ Failed to create c-017, stopping test');
    return;
  }

  // Verify c-017
  console.log('\n🔍 Verification for c-017:');
  if (c017.referralType === 'CUSTOMER' && c017.referrerId === c016.customerId) {
    console.log('  ✅ PASS: Correct referral type and referrer ID');
  } else {
    console.log('  ❌ FAIL: Expected CUSTOMER type with referrer_id=' + c016.customerId);
    console.log('           Got: ' + c017.referralType + ' with referrer_id=' + c017.referrerId);
  }

  // Create c-018 with c-017's code
  const c018 = await createCustomer('c-018@atemporal.co.uk', 'Customer', 'Eighteen', c017.personalCode || undefined);

  if (!c018) {
    console.error('\n❌ Failed to create c-018');
    return;
  }

  // Verify c-018
  console.log('\n🔍 Verification for c-018:');
  if (c018.referralType === 'CUSTOMER' && c018.referrerId === c017.customerId) {
    console.log('  ✅ PASS: Correct referral type and referrer ID');
  } else {
    console.log('  ❌ FAIL: Expected CUSTOMER type with referrer_id=' + c017.customerId);
    console.log('           Got: ' + c018.referralType + ' with referrer_id=' + c018.referrerId);
  }

  // Final summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 FINAL RESULTS:');
  console.log('═'.repeat(60));
  
  const allPassed = 
    c016.referralType === 'PARTNER' && c016.referrerId === partner?.id &&
    c017.referralType === 'CUSTOMER' && c017.referrerId === c016.customerId &&
    c018.referralType === 'CUSTOMER' && c018.referrerId === c017.customerId;

  if (allPassed) {
    console.log('✅ ALL TESTS PASSED - Referral fix is working correctly!');
  } else {
    console.log('❌ SOME TESTS FAILED - Referral fix needs adjustment');
  }

  // Show what partner should see
  console.log('\n📋 Partner Dashboard Expected View (p-020):');
  console.log('  Should show: c-012, c-014, c-016 (direct referrals only)');
  console.log('  Should NOT show: c-013, c-015, c-017, c-018 (customer chains)');
}

main().catch(console.error);
