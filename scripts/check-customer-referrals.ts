import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

(async () => {
  console.log('Checking customer referral data...\n');

  const { data: customers } = await supabase
    .from('customers')
    .select('email, referral_type, referrer_id, referral_code_used')
    .in('email', ['c-012@atemporal.co.uk', 'c-013@atemporal.co.uk', 'c-014@atemporal.co.uk', 'c-015@atemporal.co.uk']);

  console.log('Customers:');
  customers?.forEach(c => {
    console.log(`  ${c.email}:`);
    console.log(`    referral_type: ${c.referral_type}`);
    console.log(`    referrer_id: ${c.referrer_id}`);
    console.log(`    referral_code_used: ${c.referral_code_used}`);
  });

  const { data: partner } = await supabase
    .from('partners')
    .select('id, email')
    .eq('email', 'p-020@atemporal.co.uk')
    .single();

  console.log(`\nPartner p-020@atemporal.co.uk ID: ${partner?.id}`);

  // Check which customers should be visible to p-020
  const directReferrals = customers?.filter(c => 
    c.referral_type === 'PARTNER' && c.referrer_id === partner?.id
  );

  console.log(`\nDirect referrals for p-020 (should show in dashboard):`);
  directReferrals?.forEach(c => console.log(`  - ${c.email}`));
})();
