import { createClient } from '@supabase/supabase-js';

// Create Supabase client with service role key for testing
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing environment variables');
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

function logTest(test: string, status: 'PASS' | 'FAIL', message: string, duration: number) {
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} ${test}: ${message} (${duration}ms)`);

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

// Test state tracking
let workflowInfluencerId: string | null = null;
let workflowReferralCodes: string[] = [];

// ===== COMPLETE INFLUENCER SIGNUP WORKFLOW =====

async function testCompleteInfluencerSignup() {
  const timestamp = Date.now();
  const testData = {
    email: `workflow-test-${timestamp}@atemporal.co.uk`,
    password: 'WorkflowTest123!',
    first_name: 'Workflow',
    last_name: 'Tester',
    username: `workflow_test_${timestamp}`,
    bio: 'Complete workflow test influencer',
    phone: '+44 20 7946 1000',
    commission_rate: 12.5,
    instagram_handle: 'workflow_test_ig',
    instagram_followers: 50000,
    tiktok_handle: 'workflow_test_tt',
    tiktok_followers: 25000
  };

  // Step 1: Create auth user (simulating signup)
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: testData.email,
    password: testData.password,
    email_confirm: true,
    user_metadata: {
      first_name: testData.first_name,
      last_name: testData.last_name,
      user_type: 'influencer'
    }
  });

  if (authError) throw new Error(`Auth user creation failed: ${authError.message}`);
  if (!authData.user) throw new Error('No user returned from auth creation');

  workflowInfluencerId = authData.user.id;

  // Step 2: Create user profile
  const { error: profileError } = await supabase
    .from('user_profiles')
    .insert({
      id: workflowInfluencerId,
      email: testData.email,
      user_type: 'influencer',
      first_name: testData.first_name,
      last_name: testData.last_name,
      phone: testData.phone,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

  if (profileError) throw new Error(`Profile creation failed: ${profileError.message}`);

  // Step 3: Create influencer record (initially pending)
  const { error: influencerError } = await supabase
    .from('influencers')
    .insert({
      user_id: workflowInfluencerId,
      username: testData.username,
      bio: testData.bio,
      commission_rate: testData.commission_rate,
      approval_status: 'pending',
      is_active: false, // Not active until approved
      is_verified: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

  if (influencerError) throw new Error(`Influencer record creation failed: ${influencerError.message}`);

  // Step 4: Add social media channels
  const socialChannels = [
    {
      user_id: workflowInfluencerId,
      platform: 'instagram',
      handle: testData.instagram_handle,
      followers: testData.instagram_followers,
      is_verified: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      user_id: workflowInfluencerId,
      platform: 'tiktok',
      handle: testData.tiktok_handle,
      followers: testData.tiktok_followers,
      is_verified: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  const { error: socialError } = await supabase
    .from('influencer_social_channels')
    .insert(socialChannels);

  if (socialError) throw new Error(`Social channels creation failed: ${socialError.message}`);

  // Verify complete signup state
  const { data: completeInfluencer, error: verifyError } = await supabase
    .from('user_profiles')
    .select(`
      *,
      influencers (*),
      influencer_social_channels (*)
    `)
    .eq('id', workflowInfluencerId)
    .single();

  if (verifyError) throw new Error(`Verification failed: ${verifyError.message}`);
  if (!completeInfluencer.influencers || completeInfluencer.influencers.length !== 1) {
    throw new Error('Influencer record not found');
  }
  if (!completeInfluencer.influencer_social_channels || completeInfluencer.influencer_social_channels.length !== 2) {
    throw new Error('Expected 2 social channels');
  }
  if (completeInfluencer.influencers[0].approval_status !== 'pending') {
    throw new Error('Expected pending approval status');
  }
  if (completeInfluencer.influencers[0].is_active) {
    throw new Error('Influencer should not be active before approval');
  }
}

// ===== ADMIN APPROVAL WORKFLOW =====

async function testAdminApprovalProcess() {
  if (!workflowInfluencerId) throw new Error('No workflow influencer ID available');

  // Step 1: Admin reviews and approves influencer
  const { data: updatedInfluencer, error: approvalError } = await supabase
    .from('influencers')
    .update({
      approval_status: 'approved',
      is_active: true,
      is_verified: true, // Admin can verify during approval
      updated_at: new Date().toISOString()
    })
    .eq('user_id', workflowInfluencerId)
    .select()
    .single();

  if (approvalError) throw new Error(`Approval failed: ${approvalError.message}`);
  if (updatedInfluencer.approval_status !== 'approved') {
    throw new Error('Approval status not updated correctly');
  }
  if (!updatedInfluencer.is_active) {
    throw new Error('Influencer should be active after approval');
  }

  // Step 2: Generate referral codes after approval
  const referralCodes = [
    {
      influencer_id: workflowInfluencerId,
      code: `WORKFLOW-MAIN-${Date.now()}`,
      description: 'Primary referral code for workflow test',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      influencer_id: workflowInfluencerId,
      code: `WORKFLOW-PROMO-${Date.now()}`,
      description: 'Promotional referral code for workflow test',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  const { data: createdCodes, error: codesError } = await supabase
    .from('influencer_referral_codes')
    .insert(referralCodes)
    .select();

  if (codesError) throw new Error(`Referral codes creation failed: ${codesError.message}`);
  if (!createdCodes || createdCodes.length !== 2) {
    throw new Error('Expected 2 referral codes to be created');
  }

  workflowReferralCodes = createdCodes.map(code => code.code);

  // Step 3: Verify complete approved state
  const { data: approvedInfluencer, error: verifyError } = await supabase
    .from('user_profiles')
    .select(`
      *,
      influencers (*),
      influencer_social_channels (*),
      influencer_referral_codes (*)
    `)
    .eq('id', workflowInfluencerId)
    .single();

  if (verifyError) throw new Error(`Approved state verification failed: ${verifyError.message}`);
  if (approvedInfluencer.influencers[0].approval_status !== 'approved') {
    throw new Error('Approval status verification failed');
  }
  if (!approvedInfluencer.influencer_referral_codes || approvedInfluencer.influencer_referral_codes.length !== 2) {
    throw new Error('Expected 2 referral codes in approved state');
  }
}

// ===== REFERRAL CODE USAGE WORKFLOW =====

async function testReferralCodeUsage() {
  if (workflowReferralCodes.length === 0) throw new Error('No referral codes available for testing');

  const testCode = workflowReferralCodes[0];

  // Step 1: Verify code is valid and active
  const { data: codeData, error: codeError } = await supabase
    .from('influencer_referral_codes')
    .select(`
      *,
      influencers:influencer_id (
        *,
        user_profiles:user_id (*)
      )
    `)
    .eq('code', testCode)
    .eq('is_active', true)
    .single();

  if (codeError) throw new Error(`Referral code lookup failed: ${codeError.message}`);
  if (!codeData.is_active) throw new Error('Referral code should be active');

  // Step 2: Track code usage (simulating customer using the code)
  const { error: trackingError } = await supabase
    .from('influencer_referral_codes')
    .update({
      usage_count: (codeData.usage_count || 0) + 1,
      last_used_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', codeData.id);

  if (trackingError) throw new Error(`Usage tracking failed: ${trackingError.message}`);

  // Step 3: Verify usage was tracked
  const { data: updatedCode, error: verifyError } = await supabase
    .from('influencer_referral_codes')
    .select('usage_count, last_used_at')
    .eq('id', codeData.id)
    .single();

  if (verifyError) throw new Error(`Usage verification failed: ${verifyError.message}`);
  if (updatedCode.usage_count !== (codeData.usage_count || 0) + 1) {
    throw new Error('Usage count not updated correctly');
  }
  if (!updatedCode.last_used_at) {
    throw new Error('Last used timestamp not set');
  }
}

// ===== INFLUENCER DEACTIVATION WORKFLOW =====

async function testInfluencerDeactivation() {
  if (!workflowInfluencerId) throw new Error('No workflow influencer ID available');

  // Step 1: Admin deactivates influencer (temporarily)
  const { data: deactivatedInfluencer, error: deactivationError } = await supabase
    .from('influencers')
    .update({
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', workflowInfluencerId)
    .select()
    .single();

  if (deactivationError) throw new Error(`Deactivation failed: ${deactivationError.message}`);
  if (deactivatedInfluencer.is_active) {
    throw new Error('Influencer should be inactive after deactivation');
  }

  // Step 2: Deactivate all referral codes
  const { error: codesDeactivationError } = await supabase
    .from('influencer_referral_codes')
    .update({
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('influencer_id', workflowInfluencerId);

  if (codesDeactivationError) throw new Error(`Referral codes deactivation failed: ${codesDeactivationError.message}`);

  // Step 3: Verify deactivated state
  const { data: inactiveInfluencer, error: verifyError } = await supabase
    .from('user_profiles')
    .select(`
      *,
      influencers (*),
      influencer_referral_codes (*)
    `)
    .eq('id', workflowInfluencerId)
    .single();

  if (verifyError) throw new Error(`Deactivation verification failed: ${verifyError.message}`);
  if (inactiveInfluencer.influencers[0].is_active) {
    throw new Error('Influencer should be inactive');
  }

  const activeCodes = inactiveInfluencer.influencer_referral_codes?.filter(code => code.is_active) || [];
  if (activeCodes.length > 0) {
    throw new Error('All referral codes should be inactive');
  }
}

// ===== REACTIVATION WORKFLOW =====

async function testInfluencerReactivation() {
  if (!workflowInfluencerId) throw new Error('No workflow influencer ID available');

  // Step 1: Admin reactivates influencer
  const { data: reactivatedInfluencer, error: reactivationError } = await supabase
    .from('influencers')
    .update({
      is_active: true,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', workflowInfluencerId)
    .select()
    .single();

  if (reactivationError) throw new Error(`Reactivation failed: ${reactivationError.message}`);
  if (!reactivatedInfluencer.is_active) {
    throw new Error('Influencer should be active after reactivation');
  }

  // Step 2: Reactivate primary referral codes
  const { error: codesReactivationError } = await supabase
    .from('influencer_referral_codes')
    .update({
      is_active: true,
      updated_at: new Date().toISOString()
    })
    .eq('influencer_id', workflowInfluencerId)
    .like('description', '%Primary%');

  if (codesReactivationError) throw new Error(`Referral codes reactivation failed: ${codesReactivationError.message}`);

  // Step 3: Verify reactivated state
  const { data: activeInfluencer, error: verifyError } = await supabase
    .from('user_profiles')
    .select(`
      *,
      influencers (*),
      influencer_referral_codes (*)
    `)
    .eq('id', workflowInfluencerId)
    .single();

  if (verifyError) throw new Error(`Reactivation verification failed: ${verifyError.message}`);
  if (!activeInfluencer.influencers[0].is_active) {
    throw new Error('Influencer should be active after reactivation');
  }

  const activeCodes = activeInfluencer.influencer_referral_codes?.filter(code => code.is_active) || [];
  if (activeCodes.length === 0) {
    throw new Error('At least one referral code should be active');
  }
}

// ===== DATA ANALYTICS WORKFLOW =====

async function testInfluencerAnalytics() {
  if (!workflowInfluencerId) throw new Error('No workflow influencer ID available');

  // Step 1: Get influencer analytics data
  const { data: analyticsData, error: analyticsError } = await supabase
    .from('user_profiles')
    .select(`
      id,
      email,
      first_name,
      last_name,
      created_at,
      influencers (
        username,
        bio,
        commission_rate,
        approval_status,
        is_active,
        is_verified,
        created_at,
        updated_at
      ),
      influencer_social_channels (
        platform,
        handle,
        followers,
        is_verified,
        created_at
      ),
      influencer_referral_codes (
        code,
        description,
        usage_count,
        is_active,
        created_at,
        last_used_at
      )
    `)
    .eq('id', workflowInfluencerId)
    .single();

  if (analyticsError) throw new Error(`Analytics data retrieval failed: ${analyticsError.message}`);

  // Step 2: Verify all expected data is present
  if (!analyticsData.influencers || analyticsData.influencers.length !== 1) {
    throw new Error('Expected 1 influencer record in analytics');
  }

  if (!analyticsData.influencer_social_channels || analyticsData.influencer_social_channels.length !== 2) {
    throw new Error('Expected 2 social channels in analytics');
  }

  if (!analyticsData.influencer_referral_codes || analyticsData.influencer_referral_codes.length !== 2) {
    throw new Error('Expected 2 referral codes in analytics');
  }

  // Step 3: Calculate summary metrics
  const totalFollowers = analyticsData.influencer_social_channels.reduce((sum, channel) => sum + (channel.followers || 0), 0);
  const totalCodeUsage = analyticsData.influencer_referral_codes.reduce((sum, code) => sum + (code.usage_count || 0), 0);
  const activeCodesCount = analyticsData.influencer_referral_codes.filter(code => code.is_active).length;

  if (totalFollowers <= 0) throw new Error('Expected positive total followers');
  if (totalCodeUsage <= 0) throw new Error('Expected positive total code usage');
  if (activeCodesCount <= 0) throw new Error('Expected active referral codes');

  console.log(`   Analytics Summary: ${totalFollowers} followers, ${totalCodeUsage} code uses, ${activeCodesCount} active codes`);
}

// ===== CLEANUP WORKFLOW =====

async function testWorkflowCleanup() {
  if (!workflowInfluencerId) throw new Error('No workflow influencer ID for cleanup');

  let cleanupErrors: string[] = [];

  // Delete referral codes
  const { error: codesError } = await supabase
    .from('influencer_referral_codes')
    .delete()
    .eq('influencer_id', workflowInfluencerId);
  if (codesError) cleanupErrors.push(`Referral codes: ${codesError.message}`);

  // Delete social channels
  const { error: channelsError } = await supabase
    .from('influencer_social_channels')
    .delete()
    .eq('user_id', workflowInfluencerId);
  if (channelsError) cleanupErrors.push(`Social channels: ${channelsError.message}`);

  // Delete influencer record
  const { error: influencerError } = await supabase
    .from('influencers')
    .delete()
    .eq('user_id', workflowInfluencerId);
  if (influencerError) cleanupErrors.push(`Influencer record: ${influencerError.message}`);

  // Delete user profile
  const { error: profileError } = await supabase
    .from('user_profiles')
    .delete()
    .eq('id', workflowInfluencerId);
  if (profileError) cleanupErrors.push(`User profile: ${profileError.message}`);

  // Delete auth user
  const { error: authError } = await supabase.auth.admin.deleteUser(workflowInfluencerId);
  if (authError) cleanupErrors.push(`Auth user: ${authError.message}`);

  if (cleanupErrors.length > 0) {
    throw new Error(`Cleanup failed: ${cleanupErrors.join('; ')}`);
  }

  // Verify cleanup completed
  const { data: remainingData, error: verifyError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', workflowInfluencerId);

  if (verifyError && !verifyError.message.includes('No rows')) {
    throw new Error(`Cleanup verification failed: ${verifyError.message}`);
  }

  if (remainingData && remainingData.length > 0) {
    throw new Error('Data still exists after cleanup');
  }
}

// ===== MAIN TEST RUNNER =====

async function runAllTests() {
  console.log('🔄 Starting Influencer End-to-End Workflow Tests');
  console.log('=' .repeat(60));

  console.log('\n👤 Complete Influencer Signup Workflow');
  console.log('-'.repeat(40));
  await runTest('Complete Influencer Signup', testCompleteInfluencerSignup);

  console.log('\n✅ Admin Approval Workflow');
  console.log('-'.repeat(40));
  await runTest('Admin Approval Process', testAdminApprovalProcess);

  console.log('\n🎟️ Referral Code Usage Workflow');
  console.log('-'.repeat(40));
  await runTest('Referral Code Usage', testReferralCodeUsage);

  console.log('\n⏸️ Influencer Deactivation Workflow');
  console.log('-'.repeat(40));
  await runTest('Influencer Deactivation', testInfluencerDeactivation);

  console.log('\n▶️ Reactivation Workflow');
  console.log('-'.repeat(40));
  await runTest('Influencer Reactivation', testInfluencerReactivation);

  console.log('\n📊 Analytics Workflow');
  console.log('-'.repeat(40));
  await runTest('Influencer Analytics', testInfluencerAnalytics);

  console.log('\n🧹 Cleanup Workflow');
  console.log('-'.repeat(40));
  await runTest('Workflow Cleanup', testWorkflowCleanup);

  console.log('\n' + '='.repeat(60));
  console.log('🏁 Workflow Test Results Summary');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`📊 Total: ${testsPassed + testsFailed}`);

  if (testsFailed === 0) {
    console.log('\n🎉 All workflows completed successfully!');
    console.log('   • Influencer signup → approval → usage → management workflows work correctly');
    console.log('   • Data integrity maintained throughout all state transitions');
    console.log('   • Analytics and reporting data available as expected');
  } else {
    console.log('\n⚠️ Some workflow tests failed:');
    console.log('   • This indicates issues with the complete user journey');
    console.log('   • Review failed tests for workflow integration problems');
  }

  process.exit(testsFailed > 0 ? 1 : 0);
}

// Run the tests
runAllTests().catch((error) => {
  console.error('\n💥 Unexpected error running workflow tests:', error);
  process.exit(1);
});