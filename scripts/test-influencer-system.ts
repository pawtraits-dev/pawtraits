import { createClient } from '@supabase/supabase-js';

// Create Supabase client with service role key for testing
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

// Test results tracking
let testsPassed = 0;
let testsFailed = 0;
let testResults: { test: string; status: 'PASS' | 'FAIL'; message: string; duration: number }[] = [];

function logTest(test: string, status: 'PASS' | 'FAIL', message: string, duration: number) {
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} ${test}: ${message} (${duration}ms)`);
  testResults.push({ test, status, message, duration });

  if (status === 'PASS') testsPassed++;
  else testsFailed++;
}

async function runTest(testName: string, testFn: () => Promise<void>): Promise<void> {
  const startTime = Date.now();
  try {
    await testFn();
    const duration = Date.now() - startTime;
    logTest(testName, 'PASS', 'Success', duration);
  } catch (error) {
    const duration = Date.now() - startTime;
    const message = error instanceof Error ? error.message : 'Unknown error';
    logTest(testName, 'FAIL', message, duration);
  }
}

// Test data with unique identifiers to avoid conflicts
const testInfluencerData = {
  email: `test-inf-${Date.now()}@atemporal.co.uk`,
  password: 'TestPassword123!',
  first_name: 'Test',
  last_name: 'Influencer',
  username: `test_inf_${Date.now().toString().slice(-6)}`,
  bio: 'Test influencer bio for automated testing',
  phone: '+44 20 7946 0999',
  commission_rate: 12.5,
  approval_status: 'pending' as const,
  is_active: true,
  is_verified: false
};

let createdUserId: string | null = null;
let createdInfluencerId: string | null = null;
let createdReferralCodeId: string | null = null;

// ===== AUTHENTICATION & USER CREATION TESTS =====

async function testCreateInfluencerUser() {
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: testInfluencerData.email,
    password: testInfluencerData.password,
    email_confirm: true
  });

  if (authError) throw new Error(`Auth creation failed: ${authError.message}`);
  if (!authData.user) throw new Error('No user returned from auth creation');

  createdUserId = authData.user.id;

  // Verify user was created
  const { data: user, error: getUserError } = await supabase.auth.admin.getUserById(createdUserId);
  if (getUserError) throw new Error(`Failed to retrieve created user: ${getUserError.message}`);
  if (!user.user) throw new Error('User not found after creation');
}

async function testCreateUserProfile() {
  if (!createdUserId) throw new Error('No user ID available');

  const { error: profileError } = await supabase
    .from('user_profiles')
    .insert({
      id: createdUserId,
      email: testInfluencerData.email,
      user_type: 'influencer',
      first_name: testInfluencerData.first_name,
      last_name: testInfluencerData.last_name,
      phone: testInfluencerData.phone,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

  if (profileError) throw new Error(`Profile creation failed: ${profileError.message}`);

  // Verify profile was created
  const { data: profile, error: getProfileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', createdUserId)
    .single();

  if (getProfileError) throw new Error(`Failed to retrieve profile: ${getProfileError.message}`);
  if (profile.user_type !== 'influencer') throw new Error('Profile user_type is not influencer');
}

async function testCreateInfluencerRecord() {
  if (!createdUserId) throw new Error('No user ID available');

  const { data, error } = await supabase
    .from('influencers')
    .insert({
      user_id: createdUserId,
      username: testInfluencerData.username,
      bio: testInfluencerData.bio,
      commission_rate: testInfluencerData.commission_rate,
      approval_status: testInfluencerData.approval_status,
      is_active: testInfluencerData.is_active,
      is_verified: testInfluencerData.is_verified,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw new Error(`Influencer record creation failed: ${error.message}`);
  if (!data) throw new Error('No influencer record returned');

  createdInfluencerId = data.user_id;

  // Verify record was created correctly
  if (data.username !== testInfluencerData.username) throw new Error('Username mismatch');
  if (data.commission_rate !== testInfluencerData.commission_rate) throw new Error('Commission rate mismatch');
}

// ===== SOCIAL CHANNELS TESTS =====

async function testCreateSocialChannels() {
  if (!createdUserId) throw new Error('No user ID available');

  const socialChannels = [
    {
      user_id: createdUserId,
      platform: 'instagram',
      handle: 'test_instagram_handle',
      followers: 25000,
      is_verified: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      user_id: createdUserId,
      platform: 'tiktok',
      handle: 'test_tiktok_handle',
      followers: 15000,
      is_verified: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  const { data, error } = await supabase
    .from('influencer_social_channels')
    .insert(socialChannels)
    .select();

  if (error) throw new Error(`Social channels creation failed: ${error.message}`);
  if (!data || data.length !== 2) throw new Error('Expected 2 social channels to be created');

  // Verify channels were created correctly
  const { data: channels, error: getChannelsError } = await supabase
    .from('influencer_social_channels')
    .select('*')
    .eq('user_id', createdUserId);

  if (getChannelsError) throw new Error(`Failed to retrieve social channels: ${getChannelsError.message}`);
  if (channels.length !== 2) throw new Error(`Expected 2 channels, got ${channels.length}`);

  const instagramChannel = channels.find(c => c.platform === 'instagram');
  const tiktokChannel = channels.find(c => c.platform === 'tiktok');

  if (!instagramChannel || !tiktokChannel) throw new Error('Missing expected social channels');
  if (instagramChannel.followers !== 25000) throw new Error('Instagram followers mismatch');
  if (tiktokChannel.followers !== 15000) throw new Error('TikTok followers mismatch');
}

async function testUpdateSocialChannel() {
  if (!createdUserId) throw new Error('No user ID available');

  const { data, error } = await supabase
    .from('influencer_social_channels')
    .update({ followers: 30000 })
    .eq('user_id', createdUserId)
    .eq('platform', 'instagram')
    .select()
    .single();

  if (error) throw new Error(`Social channel update failed: ${error.message}`);
  if (data.followers !== 30000) throw new Error('Followers count not updated correctly');
}

// ===== REFERRAL CODES TESTS =====

async function testCreateReferralCode() {
  if (!createdUserId) throw new Error('No user ID available');

  const referralCode = `TEST-${testInfluencerData.username.toUpperCase().slice(0, 8)}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

  const { data, error } = await supabase
    .from('influencer_referral_codes')
    .insert({
      influencer_id: createdUserId,
      code: referralCode,
      description: 'Test referral code for automated testing',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw new Error(`Referral code creation failed: ${error.message}`);
  if (!data) throw new Error('No referral code returned');

  createdReferralCodeId = data.id;

  // Verify code was created correctly
  if (data.code !== referralCode) throw new Error('Referral code mismatch');
  if (!data.is_active) throw new Error('Referral code should be active');
}

async function testReferralCodeUniqueness() {
  if (!createdUserId || !createdReferralCodeId) throw new Error('Prerequisites not met');

  // Get the existing code
  const { data: existingCode, error: getError } = await supabase
    .from('influencer_referral_codes')
    .select('code')
    .eq('id', createdReferralCodeId)
    .single();

  if (getError) throw new Error(`Failed to get existing code: ${getError.message}`);

  // Try to create a duplicate code (should fail)
  const { error: duplicateError } = await supabase
    .from('influencer_referral_codes')
    .insert({
      influencer_id: createdUserId,
      code: existingCode.code,
      description: 'Duplicate test code',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

  if (!duplicateError) throw new Error('Expected duplicate code creation to fail');
  if (!duplicateError.message.includes('duplicate') && !duplicateError.message.includes('unique')) {
    throw new Error('Duplicate error message unexpected');
  }
}

// ===== CRUD OPERATIONS TESTS =====

async function testUpdateInfluencerRecord() {
  if (!createdUserId) throw new Error('No user ID available');

  const newBio = 'Updated bio for automated testing';
  const newCommissionRate = 15.0;

  const { data, error } = await supabase
    .from('influencers')
    .update({
      bio: newBio,
      commission_rate: newCommissionRate,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', createdUserId)
    .select()
    .single();

  if (error) throw new Error(`Influencer update failed: ${error.message}`);
  if (data.bio !== newBio) throw new Error('Bio not updated correctly');
  if (data.commission_rate !== newCommissionRate) throw new Error('Commission rate not updated correctly');
}

async function testInfluencerApproval() {
  if (!createdUserId) throw new Error('No user ID available');

  // Test approval
  const { data, error } = await supabase
    .from('influencers')
    .update({
      approval_status: 'approved',
      is_active: true,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', createdUserId)
    .select()
    .single();

  if (error) throw new Error(`Approval update failed: ${error.message}`);
  if (data.approval_status !== 'approved') throw new Error('Approval status not updated');
  if (!data.is_active) throw new Error('Influencer should be active after approval');
}

// ===== DATA RETRIEVAL TESTS =====

async function testGetInfluencerWithDetails() {
  if (!createdUserId) throw new Error('No user ID available');

  const { data, error } = await supabase
    .from('user_profiles')
    .select(`
      *,
      influencers (*),
      influencer_social_channels (*),
      influencer_referral_codes (*)
    `)
    .eq('id', createdUserId)
    .eq('user_type', 'influencer')
    .single();

  if (error) throw new Error(`Failed to retrieve influencer details: ${error.message}`);
  if (!data.influencers || data.influencers.length === 0) throw new Error('No influencer record found');
  if (!data.influencer_social_channels || data.influencer_social_channels.length !== 2) throw new Error('Expected 2 social channels');
  if (!data.influencer_referral_codes || data.influencer_referral_codes.length !== 1) throw new Error('Expected 1 referral code');
}

async function testGetInfluencersList() {
  const { data, error } = await supabase
    .from('user_profiles')
    .select(`
      *,
      influencers (*)
    `)
    .eq('user_type', 'influencer')
    .like('email', '%@atemporal.co.uk');

  if (error) throw new Error(`Failed to retrieve influencers list: ${error.message}`);
  if (!data || data.length === 0) throw new Error('No influencers found');

  // Should find our test influencer
  const testInfluencer = data.find(inf => inf.id === createdUserId);
  if (!testInfluencer) throw new Error('Test influencer not found in list');
}

// ===== CLEANUP TESTS =====

async function testCleanupTestData() {
  if (!createdUserId) throw new Error('No user ID for cleanup');

  let cleanupErrors: string[] = [];

  // Delete referral codes
  const { error: codesError } = await supabase
    .from('influencer_referral_codes')
    .delete()
    .eq('influencer_id', createdUserId);
  if (codesError) cleanupErrors.push(`Referral codes: ${codesError.message}`);

  // Delete social channels
  const { error: channelsError } = await supabase
    .from('influencer_social_channels')
    .delete()
    .eq('user_id', createdUserId);
  if (channelsError) cleanupErrors.push(`Social channels: ${channelsError.message}`);

  // Delete influencer record
  const { error: influencerError } = await supabase
    .from('influencers')
    .delete()
    .eq('user_id', createdUserId);
  if (influencerError) cleanupErrors.push(`Influencer record: ${influencerError.message}`);

  // Delete user profile
  const { error: profileError } = await supabase
    .from('user_profiles')
    .delete()
    .eq('id', createdUserId);
  if (profileError) cleanupErrors.push(`User profile: ${profileError.message}`);

  // Delete auth user
  const { error: authError } = await supabase.auth.admin.deleteUser(createdUserId);
  if (authError) cleanupErrors.push(`Auth user: ${authError.message}`);

  if (cleanupErrors.length > 0) {
    throw new Error(`Cleanup failed: ${cleanupErrors.join('; ')}`);
  }
}

// ===== MAIN TEST RUNNER =====

async function runAllTests() {
  console.log('🚀 Starting Influencer System Automated Tests');
  console.log('=' .repeat(60));

  console.log('\n📝 Authentication & User Creation Tests');
  console.log('-'.repeat(40));
  await runTest('Create Influencer Auth User', testCreateInfluencerUser);
  await runTest('Create User Profile', testCreateUserProfile);
  await runTest('Create Influencer Record', testCreateInfluencerRecord);

  console.log('\n📱 Social Channels Tests');
  console.log('-'.repeat(40));
  await runTest('Create Social Channels', testCreateSocialChannels);
  await runTest('Update Social Channel', testUpdateSocialChannel);

  console.log('\n🎟️ Referral Codes Tests');
  console.log('-'.repeat(40));
  await runTest('Create Referral Code', testCreateReferralCode);
  await runTest('Test Referral Code Uniqueness', testReferralCodeUniqueness);

  console.log('\n✏️ CRUD Operations Tests');
  console.log('-'.repeat(40));
  await runTest('Update Influencer Record', testUpdateInfluencerRecord);
  await runTest('Test Influencer Approval', testInfluencerApproval);

  console.log('\n📊 Data Retrieval Tests');
  console.log('-'.repeat(40));
  await runTest('Get Influencer With Details', testGetInfluencerWithDetails);
  await runTest('Get Influencers List', testGetInfluencersList);

  console.log('\n🧹 Cleanup Tests');
  console.log('-'.repeat(40));
  await runTest('Cleanup Test Data', testCleanupTestData);

  console.log('\n' + '='.repeat(60));
  console.log('🏁 Test Results Summary');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`📊 Total: ${testsPassed + testsFailed}`);

  if (testsFailed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults
      .filter(result => result.status === 'FAIL')
      .forEach(result => {
        console.log(`   • ${result.test}: ${result.message}`);
      });
  }

  console.log('\n⏱️ Performance Summary:');
  const totalDuration = testResults.reduce((sum, result) => sum + result.duration, 0);
  console.log(`   • Total time: ${totalDuration}ms`);
  console.log(`   • Average per test: ${Math.round(totalDuration / testResults.length)}ms`);

  const slowestTest = testResults.sort((a, b) => b.duration - a.duration)[0];
  if (slowestTest) {
    console.log(`   • Slowest test: ${slowestTest.test} (${slowestTest.duration}ms)`);
  }

  process.exit(testsFailed > 0 ? 1 : 0);
}

// Run the tests
runAllTests().catch((error) => {
  console.error('\n💥 Unexpected error running tests:', error);
  process.exit(1);
});