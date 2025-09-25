import { createClient } from '@supabase/supabase-js';

// Create Supabase client with service role key for user creation
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing environment variables');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!serviceRoleKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Test influencer data with standardized email format
const testInfluencers = [
  {
    email: 'I-001@atemporal.co.uk',
    password: 'TestInfluencer2024!',
    first_name: 'Sarah',
    last_name: 'Johnson',
    username: 'sarahj_pets',
    bio: 'Professional pet photographer and Instagram influencer. Specializing in dog portraits and pet lifestyle content.',
    phone: '+44 20 7946 0001',
    commission_rate: 15.0,
    approval_status: 'approved' as const,
    is_active: true,
    is_verified: true,
    instagram_handle: 'sarahj_pets',
    instagram_followers: 25000,
    tiktok_handle: 'sarahjohnson_pets',
    tiktok_followers: 15000,
  },
  {
    email: 'I-002@atemporal.co.uk',
    password: 'TestInfluencer2024!',
    first_name: 'Mike',
    last_name: 'Thompson',
    username: 'mike_dogtrainer',
    bio: 'Certified dog trainer with 10+ years experience. Creating educational content about dog behavior and training.',
    phone: '+44 20 7946 0002',
    commission_rate: 12.0,
    approval_status: 'pending' as const,
    is_active: true,
    is_verified: false,
    instagram_handle: 'mike_dogtrainer',
    instagram_followers: 18500,
    youtube_handle: 'Mike Thompson Dog Training',
    youtube_followers: 8200,
  },
  {
    email: 'I-003@atemporal.co.uk',
    password: 'TestInfluencer2024!',
    first_name: 'Emma',
    last_name: 'Wilson',
    username: 'emma_catmom',
    bio: 'Cat enthusiast and blogger. Sharing tips about cat care, health, and creating beautiful spaces for our feline friends.',
    phone: '+44 20 7946 0003',
    commission_rate: 10.0,
    approval_status: 'approved' as const,
    is_active: true,
    is_verified: true,
    instagram_handle: 'emma_catmom',
    instagram_followers: 32000,
    tiktok_handle: 'emmawilson_cats',
    tiktok_followers: 22000,
    youtube_handle: 'Emma\'s Cat Corner',
    youtube_followers: 12500,
  },
  {
    email: 'I-004@atemporal.co.uk',
    password: 'TestInfluencer2024!',
    first_name: 'David',
    last_name: 'Chen',
    username: 'david_petvet',
    bio: 'Licensed veterinarian sharing pet health education and wellness tips. Helping pet owners make informed decisions.',
    phone: '+44 20 7946 0004',
    commission_rate: 20.0,
    approval_status: 'rejected' as const,
    is_active: false,
    is_verified: false,
    instagram_handle: 'dr_david_petvet',
    instagram_followers: 45000,
    youtube_handle: 'Dr. David Chen - Pet Health',
    youtube_followers: 28000,
  },
  {
    email: 'I-005@atemporal.co.uk',
    password: 'TestInfluencer2024!',
    first_name: 'Lucy',
    last_name: 'Martinez',
    username: 'lucy_rescuelove',
    bio: 'Animal rescue volunteer and advocate. Promoting pet adoption and sharing heartwarming rescue stories.',
    phone: '+44 20 7946 0005',
    commission_rate: 8.0,
    approval_status: 'pending' as const,
    is_active: true,
    is_verified: false,
    instagram_handle: 'lucy_rescuelove',
    instagram_followers: 12800,
    tiktok_handle: 'lucymartinez_rescue',
    tiktok_followers: 9500,
  }
];

async function createTestInfluencers() {
  console.log('🚀 Starting test influencer creation...');
  console.log(`Creating ${testInfluencers.length} test influencers with standardized emails`);

  for (const influencer of testInfluencers) {
    try {
      console.log(`\n📝 Creating influencer: ${influencer.email}`);

      // 1. Create Supabase auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: influencer.email,
        password: influencer.password,
        email_confirm: true
      });

      if (authError) {
        console.error(`❌ Auth creation failed for ${influencer.email}:`, authError.message);
        continue;
      }

      console.log(`✅ Auth user created: ${authData.user?.id}`);

      // 2. Create user profile
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: authData.user!.id,
          email: influencer.email,
          user_type: 'influencer',
          first_name: influencer.first_name,
          last_name: influencer.last_name,
          phone: influencer.phone,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (profileError) {
        console.error(`❌ Profile creation failed for ${influencer.email}:`, profileError.message);
        continue;
      }

      console.log(`✅ User profile created`);

      // 3. Create influencer record
      const { error: influencerError } = await supabase
        .from('influencers')
        .insert({
          user_id: authData.user!.id,
          username: influencer.username,
          bio: influencer.bio,
          commission_rate: influencer.commission_rate,
          approval_status: influencer.approval_status,
          is_active: influencer.is_active,
          is_verified: influencer.is_verified,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (influencerError) {
        console.error(`❌ Influencer record creation failed for ${influencer.email}:`, influencerError.message);
        continue;
      }

      console.log(`✅ Influencer record created`);

      // 4. Create social channels
      const socialChannels = [];

      if (influencer.instagram_handle) {
        socialChannels.push({
          user_id: authData.user!.id,
          platform: 'instagram',
          handle: influencer.instagram_handle,
          followers: influencer.instagram_followers,
          is_verified: influencer.is_verified,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }

      if (influencer.tiktok_handle) {
        socialChannels.push({
          user_id: authData.user!.id,
          platform: 'tiktok',
          handle: influencer.tiktok_handle,
          followers: influencer.tiktok_followers,
          is_verified: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }

      if (influencer.youtube_handle) {
        socialChannels.push({
          user_id: authData.user!.id,
          platform: 'youtube',
          handle: influencer.youtube_handle,
          followers: influencer.youtube_followers,
          is_verified: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }

      if (socialChannels.length > 0) {
        const { error: socialError } = await supabase
          .from('influencer_social_channels')
          .insert(socialChannels);

        if (socialError) {
          console.error(`❌ Social channels creation failed for ${influencer.email}:`, socialError.message);
        } else {
          console.log(`✅ Social channels created: ${socialChannels.length}`);
        }
      }

      // 5. Create referral codes for approved influencers
      if (influencer.approval_status === 'approved') {
        const referralCode = `INF-${influencer.username.toUpperCase().slice(0, 8)}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

        const { error: referralError } = await supabase
          .from('influencer_referral_codes')
          .insert({
            influencer_id: authData.user!.id,
            code: referralCode,
            description: `Primary referral code for ${influencer.first_name} ${influencer.last_name}`,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (referralError) {
          console.error(`❌ Referral code creation failed for ${influencer.email}:`, referralError.message);
        } else {
          console.log(`✅ Referral code created: ${referralCode}`);
        }
      }

      console.log(`🎉 Successfully created influencer: ${influencer.email}`);

    } catch (error) {
      console.error(`💥 Unexpected error creating ${influencer.email}:`, error);
    }
  }

  console.log('\n🏁 Test influencer creation completed!');
}

async function verifyTestInfluencers() {
  console.log('\n🔍 Verifying created influencers...');

  try {
    // Get all influencers with standardized email pattern
    const { data: influencers, error } = await supabase
      .from('user_profiles')
      .select(`
        *,
        influencers (*),
        influencer_social_channels (*),
        influencer_referral_codes (*)
      `)
      .eq('user_type', 'influencer')
      .like('email', 'I-%@atemporal.co.uk');

    if (error) {
      console.error('❌ Verification query failed:', error.message);
      return;
    }

    console.log(`✅ Found ${influencers?.length || 0} test influencers`);

    influencers?.forEach((influencer, index) => {
      console.log(`\n${index + 1}. ${influencer.email}`);
      console.log(`   Name: ${influencer.first_name} ${influencer.last_name}`);
      console.log(`   Status: ${influencer.influencers?.[0]?.approval_status || 'No influencer record'}`);
      console.log(`   Active: ${influencer.influencers?.[0]?.is_active ? 'Yes' : 'No'}`);
      console.log(`   Social Channels: ${influencer.influencer_social_channels?.length || 0}`);
      console.log(`   Referral Codes: ${influencer.influencer_referral_codes?.length || 0}`);
    });

  } catch (error) {
    console.error('💥 Verification failed:', error);
  }
}

// Run the script
async function main() {
  await createTestInfluencers();
  await verifyTestInfluencers();
  process.exit(0);
}

main().catch(console.error);