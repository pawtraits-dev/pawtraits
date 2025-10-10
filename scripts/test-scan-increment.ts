/**
 * Test script to verify partner scan count increment
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  const code = 'PEUWQLMN';

  console.log(`\n🔍 Testing scan count increment for code: ${code}\n`);

  // 1. Get partner data before increment
  const { data: partnerBefore, error: beforeError } = await supabase
    .from('partners')
    .select('id, business_name, first_name, last_name, personal_referral_code, referral_scans_count')
    .eq('personal_referral_code', code)
    .single();

  if (beforeError || !partnerBefore) {
    console.error('❌ Partner not found:', beforeError);
    process.exit(1);
  }

  console.log('📊 Partner BEFORE increment:');
  console.log(`   ID: ${partnerBefore.id}`);
  console.log(`   Name: ${partnerBefore.business_name || `${partnerBefore.first_name} ${partnerBefore.last_name}`}`);
  console.log(`   Code: ${partnerBefore.personal_referral_code}`);
  console.log(`   Scan Count: ${partnerBefore.referral_scans_count}\n`);

  // 2. Test the RPC function
  console.log('⚡ Calling increment_partner_referral_scans RPC function...\n');

  const { error: rpcError } = await supabase.rpc('increment_partner_referral_scans', {
    p_partner_id: partnerBefore.id
  });

  if (rpcError) {
    console.error('❌ RPC function failed:', rpcError);
    console.error('   Error details:', JSON.stringify(rpcError, null, 2));
    process.exit(1);
  }

  console.log('✅ RPC function executed successfully\n');

  // 3. Get partner data after increment
  const { data: partnerAfter, error: afterError } = await supabase
    .from('partners')
    .select('id, business_name, first_name, last_name, personal_referral_code, referral_scans_count')
    .eq('personal_referral_code', code)
    .single();

  if (afterError || !partnerAfter) {
    console.error('❌ Failed to fetch partner after increment:', afterError);
    process.exit(1);
  }

  console.log('📊 Partner AFTER increment:');
  console.log(`   ID: ${partnerAfter.id}`);
  console.log(`   Name: ${partnerAfter.business_name || `${partnerAfter.first_name} ${partnerAfter.last_name}`}`);
  console.log(`   Code: ${partnerAfter.personal_referral_code}`);
  console.log(`   Scan Count: ${partnerAfter.referral_scans_count}\n`);

  // 4. Compare
  const increment = partnerAfter.referral_scans_count - partnerBefore.referral_scans_count;

  if (increment === 1) {
    console.log('✅ SUCCESS: Scan count incremented correctly (+1)');
  } else {
    console.log(`⚠️  WARNING: Scan count increment was ${increment} (expected 1)`);
  }

  console.log('\n✅ Test complete\n');
}

main();
