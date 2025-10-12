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
  console.log('Fixing referrer_id for c-012 and c-014...\n');

  // Get partner p-020's ID
  const { data: partner } = await supabase
    .from('partners')
    .select('id')
    .eq('email', 'p-020@atemporal.co.uk')
    .single();

  if (!partner) {
    console.error('❌ Partner p-020 not found');
    process.exit(1);
  }

  console.log(`Partner p-020 ID: ${partner.id}`);

  // Update c-012
  const { error: error1 } = await supabase
    .from('customers')
    .update({ referrer_id: partner.id })
    .eq('email', 'c-012@atemporal.co.uk');

  if (error1) {
    console.error(`❌ Failed to update c-012:`, error1);
  } else {
    console.log(`✅ Updated c-012 referrer_id to ${partner.id}`);
  }

  // Update c-014
  const { error: error2 } = await supabase
    .from('customers')
    .update({ referrer_id: partner.id })
    .eq('email', 'c-014@atemporal.co.uk');

  if (error2) {
    console.error(`❌ Failed to update c-014:`, error2);
  } else {
    console.log(`✅ Updated c-014 referrer_id to ${partner.id}`);
  }

  console.log('\n✅ Done!');
})();
