import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function checkReferrer() {
  // Get c-011
  const { data: c011 } = await supabase
    .from('customers')
    .select('*')
    .eq('email', 'c-011@atemporal.co.uk')
    .single();

  console.log('c-011 Data:');
  console.log(`  referrer_id: ${c011?.referrer_id}`);
  console.log(`  referral_code_used: ${c011?.referral_code_used}`);
  console.log(`  referral_type: ${c011?.referral_type}`);

  // Check if referrer_id points to a customer
  const { data: referrerCustomer } = await supabase
    .from('customers')
    .select('id, email, personal_referral_code')
    .eq('id', c011?.referrer_id)
    .single();

  if (referrerCustomer) {
    console.log('\n✅ Referrer is a CUSTOMER:');
    console.log(`  Email: ${referrerCustomer.email}`);
    console.log(`  Personal Code: ${referrerCustomer.personal_referral_code}`);
    console.log(`  Match with c-011.referral_code_used? ${referrerCustomer.personal_referral_code === c011?.referral_code_used}`);
  }

  // Also check if c-010's personal code matches what c-011 used
  const { data: c010 } = await supabase
    .from('customers')
    .select('id, email, personal_referral_code')
    .eq('email', 'c-010@atemporal.co.uk')
    .single();

  console.log('\nc-010 Data:');
  console.log(`  ID: ${c010?.id}`);
  console.log(`  Personal Code: ${c010?.personal_referral_code}`);
  console.log(`  Match with c-011.referral_code_used? ${c010?.personal_referral_code === c011?.referral_code_used}`);
}

checkReferrer().catch(console.error);
