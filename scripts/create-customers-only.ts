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

  // Get personal referral code
  const { data: customerData } = await supabase
    .from('customers')
    .select('personal_referral_code')
    .eq('id', data.user.customerId)
    .single();

  const code = customerData?.personal_referral_code;
  console.log(`✅ Created ${email}`);
  console.log(`   Personal code: ${code}`);
  if (referralCode) {
    console.log(`   Used code: ${referralCode}`);
  }
  
  return code;
}

async function main() {
  console.log('Creating customers c-012 through c-015...\n');
  
  const c012Code = await createCustomer('c-012@atemporal.co.uk', 'Customer', 'Twelve', PARTNER_CODE);
  const c013Code = await createCustomer('c-013@atemporal.co.uk', 'Customer', 'Thirteen', c012Code || undefined);
  await createCustomer('c-014@atemporal.co.uk', 'Customer', 'Fourteen', PARTNER_CODE);
  await createCustomer('c-015@atemporal.co.uk', 'Customer', 'Fifteen', c013Code || undefined);
  
  console.log('\n✅ Done!');
}

main().catch(console.error);
