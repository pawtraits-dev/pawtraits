import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function backfillMissingUserProfiles() {
  console.log('\n🔧 Backfilling missing user_profiles for partners...\n');

  try {
    // Get all partners
    const { data: partners, error: partnersError } = await supabase
      .from('partners')
      .select('id, email, first_name, last_name, phone, business_name, created_at')
      .order('created_at', { ascending: false });

    if (partnersError) {
      console.error('❌ Error fetching partners:', partnersError);
      return;
    }

    console.log(`📊 Processing ${partners.length} partners...`);

    const created = [];
    const skipped = [];
    const errors = [];

    for (const partner of partners) {
      console.log(`\n🔍 Processing: ${partner.email}`);

      // Check if user profile already exists
      const { data: existingProfile, error: checkError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('user_id', partner.id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error(`   ❌ Error checking profile: ${checkError.message}`);
        errors.push({ partner: partner.email, error: checkError.message });
        continue;
      }

      if (existingProfile) {
        console.log(`   ✅ Profile already exists, skipping`);
        skipped.push(partner.email);
        continue;
      }

      // Verify auth user exists
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

      if (authError) {
        console.error(`   ❌ Error checking auth users: ${authError.message}`);
        errors.push({ partner: partner.email, error: `Auth check failed: ${authError.message}` });
        continue;
      }

      const authUser = authUsers.users.find(u => u.email === partner.email);

      if (!authUser) {
        console.log(`   ⚠️  No auth user found for ${partner.email}, skipping`);
        skipped.push(partner.email);
        continue;
      }

      if (authUser.id !== partner.id) {
        console.log(`   ⚠️  Auth user ID mismatch for ${partner.email}`);
        console.log(`        Partner ID: ${partner.id}`);
        console.log(`        Auth ID: ${authUser.id}`);
        console.log(`   🔧 Using auth user ID for profile creation...`);
      }

      // Create missing user profile
      const { data: newProfile, error: createError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: authUser.id, // Use auth user ID, not partner ID
          user_type: 'partner',
          first_name: partner.first_name,
          last_name: partner.last_name,
          email: partner.email,
          phone: partner.phone,
          partner_id: partner.id, // Link to partner record
          status: 'active'
        })
        .select()
        .single();

      if (createError) {
        console.error(`   ❌ Failed to create profile: ${createError.message}`);
        errors.push({ partner: partner.email, error: createError.message });
        continue;
      }

      console.log(`   ✅ Created user profile: ${newProfile.id}`);
      created.push({
        email: partner.email,
        profileId: newProfile.id,
        partnerId: partner.id,
        authId: authUser.id
      });

      // Test the profile works
      const { data: testProfile, error: testError } = await supabase
        .rpc('get_user_profile', { user_uuid: authUser.id });

      if (testError) {
        console.log(`   ⚠️  Profile created but RPC test failed: ${testError.message}`);
      } else if (testProfile && testProfile.user_type === 'partner') {
        console.log(`   ✅ Profile verified with RPC function`);
      } else {
        console.log(`   ⚠️  Profile created but RPC returned unexpected data`);
      }
    }

    // Summary
    console.log(`\n📊 Backfill Summary:`);
    console.log(`✅ Profiles created: ${created.length}`);
    console.log(`⏭️  Profiles skipped (already existed): ${skipped.length}`);
    console.log(`❌ Errors encountered: ${errors.length}`);

    if (created.length > 0) {
      console.log(`\n✅ Successfully created profiles for:`);
      created.forEach(item => {
        console.log(`   - ${item.email} (Profile: ${item.profileId})`);
      });
    }

    if (errors.length > 0) {
      console.log(`\n❌ Errors encountered:`);
      errors.forEach(item => {
        console.log(`   - ${item.partner}: ${item.error}`);
      });
    }

    console.log('\n🎉 Backfill process completed!');

  } catch (error) {
    console.error('❌ Fatal error during backfill:', error);
  }
}

backfillMissingUserProfiles().catch(console.error);