import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables from .env.local
try {
  const envPath = join(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf8');

  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        process.env[key] = valueParts.join('=');
      }
    }
  });
} catch (error) {
  console.error('Could not load .env.local file:', error);
}

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

// Test data matching the actual schema
const testInfluencerData = {
  email: `test-inf-${Date.now()}@atemporal.co.uk`,
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

let createdInfluencerId: string | null = null;
let createdReferralCodeId: string | null = null;

// ===== INFLUENCER CREATION TESTS =====

async function testCreateInfluencer() {
  const { data, error } = await supabase
    .from('influencers')
    .insert({
      email: testInfluencerData.email,
      first_name: testInfluencerData.first_name,
      last_name: testInfluencerData.last_name,
      username: testInfluencerData.username,
      bio: testInfluencerData.bio,
      phone: testInfluencerData.phone,
      commission_rate: testInfluencerData.commission_rate,
      approval_status: testInfluencerData.approval_status,
      is_active: testInfluencerData.is_active,
      is_verified: testInfluencerData.is_verified
    })
    .select()
    .single();

  if (error) throw new Error(`Influencer creation failed: ${error.message}`);
  if (!data) throw new Error('No influencer data returned');

  createdInfluencerId = data.id;

  // Verify created correctly
  if (data.email !== testInfluencerData.email) throw new Error('Email mismatch');
  if (data.username !== testInfluencerData.username) throw new Error('Username mismatch');
  if (data.commission_rate !== testInfluencerData.commission_rate) throw new Error('Commission rate mismatch');
}

async function testGetInfluencer() {
  if (!createdInfluencerId) throw new Error('No influencer ID available');

  const { data, error } = await supabase
    .from('influencers')
    .select('*')
    .eq('id', createdInfluencerId)
    .single();

  if (error) throw new Error(`Failed to retrieve influencer: ${error.message}`);
  if (!data) throw new Error('No influencer data found');
  if (data.email !== testInfluencerData.email) throw new Error('Retrieved data mismatch');
}

async function testUpdateInfluencer() {
  if (!createdInfluencerId) throw new Error('No influencer ID available');

  const newBio = 'Updated bio for automated testing';
  const newCommissionRate = 15.0;

  const { data, error } = await supabase
    .from('influencers')
    .update({
      bio: newBio,
      commission_rate: newCommissionRate,
      updated_at: new Date().toISOString()
    })
    .eq('id', createdInfluencerId)
    .select()
    .single();

  if (error) throw new Error(`Influencer update failed: ${error.message}`);
  if (data.bio !== newBio) throw new Error('Bio not updated correctly');
  if (data.commission_rate !== newCommissionRate) throw new Error('Commission rate not updated correctly');
}

// ===== SOCIAL CHANNELS TESTS =====

async function testCreateSocialChannels() {
  if (!createdInfluencerId) throw new Error('No influencer ID available');

  const socialChannels = [
    {
      influencer_id: createdInfluencerId,
      platform: 'instagram',
      username: 'test_instagram_handle',
      follower_count: 25000,
      verified: true,
      is_primary: true,
      is_active: true
    },
    {
      influencer_id: createdInfluencerId,
      platform: 'tiktok',
      username: 'test_tiktok_handle',
      follower_count: 15000,
      verified: false,
      is_primary: false,
      is_active: true
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
    .eq('influencer_id', createdInfluencerId);

  if (getChannelsError) throw new Error(`Failed to retrieve social channels: ${getChannelsError.message}`);
  if (channels.length !== 2) throw new Error(`Expected 2 channels, got ${channels.length}`);

  const instagramChannel = channels.find(c => c.platform === 'instagram');
  const tiktokChannel = channels.find(c => c.platform === 'tiktok');

  if (!instagramChannel || !tiktokChannel) throw new Error('Missing expected social channels');
  if (instagramChannel.follower_count !== 25000) throw new Error('Instagram followers mismatch');
  if (tiktokChannel.follower_count !== 15000) throw new Error('TikTok followers mismatch');
}

async function testUpdateSocialChannel() {
  if (!createdInfluencerId) throw new Error('No influencer ID available');

  const { data, error } = await supabase
    .from('influencer_social_channels')
    .update({
      follower_count: 30000,
      last_updated: new Date().toISOString()
    })
    .eq('influencer_id', createdInfluencerId)
    .eq('platform', 'instagram')
    .select()
    .single();

  if (error) throw new Error(`Social channel update failed: ${error.message}`);
  if (data.follower_count !== 30000) throw new Error('Follower count not updated correctly');
}

// ===== REFERRAL CODES TESTS =====

async function testCreateReferralCode() {
  if (!createdInfluencerId) throw new Error('No influencer ID available');

  const referralCode = `TEST-${testInfluencerData.username.toUpperCase().slice(0, 8)}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

  const { data, error } = await supabase
    .from('influencer_referral_codes')
    .insert({
      influencer_id: createdInfluencerId,
      code: referralCode,
      description: 'Test referral code for automated testing',
      is_active: true
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
  if (!createdInfluencerId || !createdReferralCodeId) throw new Error('Prerequisites not met');

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
      influencer_id: createdInfluencerId,
      code: existingCode.code,
      description: 'Duplicate test code',
      is_active: true
    });

  if (!duplicateError) throw new Error('Expected duplicate code creation to fail');
  if (!duplicateError.message.includes('duplicate') && !duplicateError.message.includes('unique')) {
    throw new Error('Duplicate error message unexpected');
  }
}

// ===== INFLUENCER APPROVAL WORKFLOW =====

async function testInfluencerApproval() {
  if (!createdInfluencerId) throw new Error('No influencer ID available');

  // Test approval
  const { data, error } = await supabase
    .from('influencers')
    .update({
      approval_status: 'approved',
      is_active: true,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', createdInfluencerId)
    .select()
    .single();

  if (error) throw new Error(`Approval update failed: ${error.message}`);
  if (data.approval_status !== 'approved') throw new Error('Approval status not updated');
  if (!data.is_active) throw new Error('Influencer should be active after approval');
  if (!data.approved_at) throw new Error('Approved timestamp not set');
}

// ===== COMPLEX QUERIES TESTS =====

async function testGetInfluencerWithDetails() {
  if (!createdInfluencerId) throw new Error('No influencer ID available');

  // Test query that joins influencer with social channels and referral codes
  const { data, error } = await supabase
    .from('influencers')
    .select(`
      *,
      influencer_social_channels (*),
      influencer_referral_codes (*)
    `)
    .eq('id', createdInfluencerId)
    .single();

  if (error) throw new Error(`Failed to retrieve influencer details: ${error.message}`);
  if (!data.influencer_social_channels || data.influencer_social_channels.length !== 2) throw new Error('Expected 2 social channels');
  if (!data.influencer_referral_codes || data.influencer_referral_codes.length !== 1) throw new Error('Expected 1 referral code');
}

async function testGetInfluencersList() {
  // Test getting list of influencers with filtering
  const { data, error } = await supabase
    .from('influencers')
    .select(`
      *,
      influencer_social_channels (count)
    `)
    .like('email', '%@atemporal.co.uk');

  if (error) throw new Error(`Failed to retrieve influencers list: ${error.message}`);
  if (!data || data.length === 0) throw new Error('No influencers found');

  // Should find our test influencer
  const testInfluencer = data.find(inf => inf.id === createdInfluencerId);
  if (!testInfluencer) throw new Error('Test influencer not found in list');
}

// ===== ANALYTICS TESTS =====

async function testInfluencerAnalytics() {
  if (!createdInfluencerId) throw new Error('No influencer ID available');

  // Test analytics-style queries
  const { data: analyticsData, error: analyticsError } = await supabase
    .from('influencers')
    .select(`
      id,
      email,
      first_name,
      last_name,
      username,
      commission_rate,
      approval_status,
      is_active,
      is_verified,
      created_at,
      influencer_social_channels (
        platform,
        username,
        follower_count,
        verified,
        is_primary
      ),
      influencer_referral_codes (
        code,
        description,
        usage_count,
        is_active,
        created_at
      )
    `)
    .eq('id', createdInfluencerId)
    .single();

  if (analyticsError) throw new Error(`Analytics data retrieval failed: ${analyticsError.message}`);

  // Calculate summary metrics
  const totalFollowers = analyticsData.influencer_social_channels.reduce((sum: number, channel: any) => sum + (channel.follower_count || 0), 0);
  const activeCodesCount = analyticsData.influencer_referral_codes.filter((code: any) => code.is_active).length;

  if (totalFollowers <= 0) throw new Error('Expected positive total followers');
  if (activeCodesCount <= 0) throw new Error('Expected active referral codes');

  console.log(`   Analytics Summary: ${totalFollowers} followers, ${activeCodesCount} active codes`);
}

// ===== CLEANUP TESTS =====

async function testCleanupTestData() {
  if (!createdInfluencerId) throw new Error('No influencer ID for cleanup');

  let cleanupErrors: string[] = [];

  // Delete referral codes
  const { error: codesError } = await supabase
    .from('influencer_referral_codes')
    .delete()
    .eq('influencer_id', createdInfluencerId);
  if (codesError) cleanupErrors.push(`Referral codes: ${codesError.message}`);

  // Delete social channels
  const { error: channelsError } = await supabase
    .from('influencer_social_channels')
    .delete()
    .eq('influencer_id', createdInfluencerId);
  if (channelsError) cleanupErrors.push(`Social channels: ${channelsError.message}`);

  // Delete influencer record
  const { error: influencerError } = await supabase
    .from('influencers')
    .delete()
    .eq('id', createdInfluencerId);
  if (influencerError) cleanupErrors.push(`Influencer record: ${influencerError.message}`);

  if (cleanupErrors.length > 0) {
    throw new Error(`Cleanup failed: ${cleanupErrors.join('; ')}`);
  }

  // Verify cleanup completed
  const { data: remainingData, error: verifyError } = await supabase
    .from('influencers')
    .select('*')
    .eq('id', createdInfluencerId);

  if (verifyError && !verifyError.message.includes('No rows')) {
    throw new Error(`Cleanup verification failed: ${verifyError.message}`);
  }

  if (remainingData && remainingData.length > 0) {
    throw new Error('Data still exists after cleanup');
  }
}

// ===== MAIN TEST RUNNER =====

async function runAllTests() {
  console.log('🚀 Starting Influencer System API Tests (Fixed for Actual Schema)');
  console.log('=' .repeat(60));

  console.log('\n📝 Influencer CRUD Operations');
  console.log('-'.repeat(40));
  await runTest('Create Influencer Record', testCreateInfluencer);
  await runTest('Get Influencer Record', testGetInfluencer);
  await runTest('Update Influencer Record', testUpdateInfluencer);

  console.log('\n📱 Social Channels Tests');
  console.log('-'.repeat(40));
  await runTest('Create Social Channels', testCreateSocialChannels);
  await runTest('Update Social Channel', testUpdateSocialChannel);

  console.log('\n🎟️ Referral Codes Tests');
  console.log('-'.repeat(40));
  await runTest('Create Referral Code', testCreateReferralCode);
  await runTest('Test Referral Code Uniqueness', testReferralCodeUniqueness);

  console.log('\n✅ Business Logic Tests');
  console.log('-'.repeat(40));
  await runTest('Test Influencer Approval', testInfluencerApproval);

  console.log('\n📊 Data Retrieval Tests');
  console.log('-'.repeat(40));
  await runTest('Get Influencer With Details', testGetInfluencerWithDetails);
  await runTest('Get Influencers List', testGetInfluencersList);

  console.log('\n📈 Analytics Tests');
  console.log('-'.repeat(40));
  await runTest('Influencer Analytics', testInfluencerAnalytics);

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