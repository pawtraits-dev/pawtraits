import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function fixPartnerProfile() {
  const partnerEmail = 'test_part6@pawtraits.pics';

  console.log(`\n🔧 Fixing partner profile: ${partnerEmail}\n`);

  // 1. Get auth user
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

  console.log('✅ Auth user found:', authUser.id);

  // 2. Get partner record
  const { data: partners, error: partnersError } = await supabase
    .from('partners')
    .select('*')
    .eq('email', partnerEmail);

  if (partnersError) {
    console.error('❌ Error getting partners:', partnersError);
    return;
  }

  if (!partners || partners.length === 0) {
    console.log('❌ No partner record found');
    return;
  }

  const partner = partners[0];
  console.log('✅ Partner record found:', partner.id);

  // 3. Check if user profile already exists
  const { data: existingProfile, error: profileCheckError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', authUser.id);

  if (profileCheckError && profileCheckError.code !== 'PGRST116') {
    console.error('❌ Error checking existing profile:', profileCheckError);
    return;
  }

  if (existingProfile && existingProfile.length > 0) {
    console.log('⚠️ User profile already exists:', existingProfile[0]);

    // Update the existing profile to ensure it's correct
    const { data: updatedProfile, error: updateError } = await supabase
      .from('user_profiles')
      .update({
        user_type: 'partner',
        partner_id: partner.id,
        first_name: partner.first_name,
        last_name: partner.last_name,
        email: partner.email,
        phone: partner.phone
      })
      .eq('user_id', authUser.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error updating user profile:', updateError);
      return;
    }

    console.log('✅ User profile updated successfully:', updatedProfile);
    return;
  }

  // 4. Create the missing user profile
  console.log('📝 Creating missing user profile...');

  const { data: newProfile, error: createError } = await supabase
    .from('user_profiles')
    .insert({
      user_id: authUser.id,
      user_type: 'partner',
      partner_id: partner.id,
      first_name: partner.first_name,
      last_name: partner.last_name,
      email: partner.email,
      phone: partner.phone,
      status: 'active'
    })
    .select()
    .single();

  if (createError) {
    console.error('❌ Error creating user profile:', createError);
    return;
  }

  console.log('✅ User profile created successfully:', newProfile);

  // 5. Test the RPC function now
  console.log('\n🧪 Testing get_user_profile RPC after fix...');
  const { data: rpcResult, error: rpcError } = await supabase
    .rpc('get_user_profile', { user_uuid: authUser.id });

  if (rpcError) {
    console.error('❌ RPC Error:', rpcError);
  } else {
    console.log('✅ RPC Result:', rpcResult);
  }
}

fixPartnerProfile().catch(console.error);