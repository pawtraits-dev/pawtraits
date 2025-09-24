import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkMissingUserProfiles() {
  console.log('\n🔍 Checking for partners missing user_profiles records...\n');

  try {
    // Get all partners
    const { data: partners, error: partnersError } = await supabase
      .from('partners')
      .select('id, email, first_name, last_name, business_name, created_at')
      .order('created_at', { ascending: false });

    if (partnersError) {
      console.error('❌ Error fetching partners:', partnersError);
      return;
    }

    console.log(`📊 Total partners found: ${partners.length}`);

    // Check which partners have user_profiles
    const partnersWithoutProfiles = [];
    const partnersWithProfiles = [];

    for (const partner of partners) {
      const { data: userProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, user_type, created_at')
        .eq('user_id', partner.id)
        .single();

      if (profileError && profileError.code === 'PGRST116') {
        // No profile found
        partnersWithoutProfiles.push(partner);
      } else if (profileError) {
        console.error(`❌ Error checking profile for ${partner.email}:`, profileError);
      } else {
        partnersWithProfiles.push({ partner, profile: userProfile });
      }
    }

    console.log(`\n📈 Results Summary:`);
    console.log(`✅ Partners WITH user_profiles: ${partnersWithProfiles.length}`);
    console.log(`❌ Partners WITHOUT user_profiles: ${partnersWithoutProfiles.length}`);

    if (partnersWithoutProfiles.length > 0) {
      console.log(`\n⚠️  Partners missing user_profiles:`);
      partnersWithoutProfiles.forEach((partner, index) => {
        console.log(`${index + 1}. ${partner.email} (${partner.first_name} ${partner.last_name})`);
        console.log(`   Business: ${partner.business_name}`);
        console.log(`   Created: ${new Date(partner.created_at).toLocaleDateString()}`);
        console.log('');
      });
    }

    if (partnersWithProfiles.length > 0) {
      console.log(`\n✅ Sample partners with profiles:`);
      partnersWithProfiles.slice(0, 3).forEach((item, index) => {
        console.log(`${index + 1}. ${item.partner.email} - Profile Type: ${item.profile.user_type}`);
      });
    }

    // Check for auth users that might not have partner records
    console.log('\n🔍 Checking for orphaned auth users...');

    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('❌ Error listing auth users:', authError);
      return;
    }

    const partnerEmails = new Set(partners.map(p => p.email));
    const orphanedAuthUsers = authUsers.users.filter(user =>
      user.email && !partnerEmails.has(user.email)
    );

    console.log(`📊 Total auth users: ${authUsers.users.length}`);
    console.log(`📊 Orphaned auth users (no partner record): ${orphanedAuthUsers.length}`);

    if (orphanedAuthUsers.length > 0 && orphanedAuthUsers.length < 10) {
      console.log('\n⚠️  Sample orphaned auth users:');
      orphanedAuthUsers.slice(0, 5).forEach((user, index) => {
        console.log(`${index + 1}. ${user.email} (Auth ID: ${user.id})`);
      });
    }

  } catch (error) {
    console.error('❌ Error during check:', error);
  }
}

checkMissingUserProfiles().catch(console.error);