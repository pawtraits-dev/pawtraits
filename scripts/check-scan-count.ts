import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  const { data } = await supabase
    .from('partners')
    .select('business_name, referral_scans_count')
    .eq('personal_referral_code', 'PEUWQLMN')
    .single();

  console.log('Partner:', data?.business_name);
  console.log('Current scan count:', data?.referral_scans_count);
}

main();
