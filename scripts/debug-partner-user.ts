import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

// Debug script to check partner user profile data
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

console.log('Environment check:', {
  supabaseUrl: supabaseUrl ? 'Present' : 'Missing',
  serviceRoleKey: serviceRoleKey ? 'Present' : 'Missing'
});

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function debugPartnerUser() {
  const partnerEmail = 'test_part6@pawtraits.pics';

  console.log(`\n🔍 Debugging partner user: ${partnerEmail}\n`);

  // 1. Check auth.users table
  console.log('1. Checking auth.users...');
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

  if (authError) {
    console.error('❌ Error listing auth users:', authError);
    return;
  }

  const authUser = authUsers.users.find(u => u.email === partnerEmail);

  if (!authUser) {
    console.log('❌ No auth user found with this email');
    return;
  }
  console.log('✅ Auth user found:', {
    id: authUser.id,
    email: authUser.email,
    created_at: authUser.created_at
  });

  // 2. Check user_profiles table
  console.log('\n2. Checking user_profiles...');
  const { data: userProfile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', authUser.id)
    .single();

  if (profileError) {
    console.error('❌ Error getting user profile:', profileError);
  } else if (!userProfile) {
    console.log('❌ No user profile found');
  } else {
    console.log('✅ User profile found:', userProfile);
  }

  // 3. Check partners table
  console.log('\n3. Checking partners table...');
  const { data: partners, error: partnersError } = await supabase
    .from('partners')
    .select('*')
    .eq('email', partnerEmail);

  if (partnersError) {
    console.error('❌ Error getting partners:', partnersError);
  } else if (!partners || partners.length === 0) {
    console.log('❌ No partner record found');
  } else {
    console.log('✅ Partner record found:', partners[0]);
  }

  // 4. Test RPC function
  console.log('\n4. Testing get_user_profile RPC...');
  const { data: rpcResult, error: rpcError } = await supabase
    .rpc('get_user_profile', { user_uuid: authUser.id });

  if (rpcError) {
    console.error('❌ RPC Error:', rpcError);
  } else {
    console.log('✅ RPC Result:', rpcResult);
  }

  // 5. Check pre-registration codes
  console.log('\n5. Checking pre-registration codes...');
  if (partners && partners.length > 0) {
    const { data: codes, error: codesError } = await supabase
      .from('pre_registration_codes')
      .select('*')
      .eq('partner_id', partners[0].id);

    if (codesError) {
      console.error('❌ Error getting codes:', codesError);
    } else {
      console.log(`✅ Found ${codes?.length || 0} pre-registration codes for this partner`);
      if (codes && codes.length > 0) {
        console.log('Sample code:', codes[0]);
      }
    }
  }
}

debugPartnerUser().catch(console.error);