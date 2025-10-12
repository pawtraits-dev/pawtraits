/**
 * Create p-016 Test Referral Accounts
 *
 * This script creates p-016 partner and customer referral chain for testing
 *
 * Run with: npx tsx scripts/create-p016-accounts.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';

// Validate required environment variables
if (!SUPABASE_URL) {
  console.error('❌ ERROR: NEXT_PUBLIC_SUPABASE_URL not found');
  process.exit(1);
}

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ ERROR: SUPABASE_SERVICE_ROLE_KEY not found');
  process.exit(1);
}

// Test account credentials
const PASSWORD = '!@£QWE123qwe';
const PRE_REG_CODE = 'TESTCODE016';

interface AccountResult {
  email: string;
  userId: string;
  referralCode?: string;
  error?: string;
}

// Initialize Supabase admin client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function createAuthUser(email: string, password: string, firstName: string, lastName: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName
      }
    });

    if (error) {
      console.error(`❌ Failed to create auth user ${email}:`, error.message);
      return null;
    }

    console.log(`✅ Created auth user: ${email} (${data.user!.id})`);
    return data.user!.id;
  } catch (error) {
    console.error(`❌ Error creating auth user ${email}:`, error);
    return null;
  }
}

async function createPartnerAccount(
  userId: string,
  email: string,
  firstName: string,
  lastName: string,
  preRegCode: string
): Promise<AccountResult> {
  try {
    const response = await fetch(`${BASE_URL}/api/p/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        email,
        firstName,
        lastName,
        phone: '+441234567890',
        businessName: `${firstName}'s Pet Grooming`,
        businessType: 'groomer',
        preRegCode: preRegCode
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return { email, userId, error: data.error || 'Failed to create partner' };
    }

    console.log(`✅ Created partner account: ${email}`);
    console.log(`   Personal code: ${data.partner.personal_referral_code}`);

    return {
      email,
      userId,
      referralCode: data.partner.personal_referral_code
    };
  } catch (error) {
    console.error(`❌ Error creating partner ${email}:`, error);
    return { email, userId, error: String(error) };
  }
}

async function createCustomerAccount(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  referralCode?: string
): Promise<AccountResult> {
  try {
    const response = await fetch(`${BASE_URL}/api/auth/signup/customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        firstName,
        lastName,
        referralCode
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return { email, userId: '', error: data.error || 'Failed to create customer' };
    }

    console.log(`✅ Created customer account: ${email}`);
    console.log(`   User ID: ${data.user.id}`);
    console.log(`   Customer ID: ${data.user.customerId}`);
    if (referralCode) {
      console.log(`   Used referral code: ${referralCode}`);
    }

    // Query database directly for personal_referral_code
    let personalReferralCode = null;
    if (data.user.customerId) {
      const { data: customerData } = await supabase
        .from('customers')
        .select('personal_referral_code')
        .eq('id', data.user.customerId)
        .single();

      personalReferralCode = customerData?.personal_referral_code || null;
      if (personalReferralCode) {
        console.log(`   Personal code: ${personalReferralCode}`);
      }
    }

    return {
      email,
      userId: data.user.customerId || data.user.id,
      referralCode: personalReferralCode
    };
  } catch (error) {
    console.error(`❌ Error creating customer ${email}:`, error);
    return { email, userId: '', error: String(error) };
  }
}

async function main() {
  console.log('🚀 Creating p-016 Test Accounts\n');
  console.log('═'.repeat(60));
  console.log('Configuration:');
  console.log(`  Base URL: ${BASE_URL}`);
  console.log(`  Password (all accounts): ${PASSWORD}`);
  console.log(`  Pre-reg code: ${PRE_REG_CODE}`);
  console.log('═'.repeat(60));
  console.log('');

  const results: Record<string, AccountResult> = {};

  // Step 1: Create Partner p-016
  console.log('📋 Step 1: Creating Partner Account (p-016)');
  console.log('-'.repeat(60));

  // Check if auth user already exists
  const { data: authData } = await supabase.auth.admin.listUsers();
  const existingUser = authData?.users.find(u => u.email === 'p-016@atemporal.co.uk');

  let userId: string | null = null;

  if (existingUser) {
    console.log(`ℹ️  Auth user already exists: ${existingUser.id}`);
    userId = existingUser.id;
  } else {
    userId = await createAuthUser('p-016@atemporal.co.uk', PASSWORD, 'Partner', 'Sixteen');
  }

  if (userId) {
    results['p-016'] = await createPartnerAccount(userId, 'p-016@atemporal.co.uk', 'Partner', 'Sixteen', PRE_REG_CODE);
  } else {
    results['p-016'] = { email: 'p-016@atemporal.co.uk', userId: '', error: 'Failed to create auth user' };
  }
  console.log('');

  if (!results['p-016'].referralCode) {
    console.error('❌ CRITICAL: Partner creation failed. Cannot continue.');
    process.exit(1);
  }

  const partnerCode = results['p-016'].referralCode!;

  // Step 2: Create Customer c-027 (direct partner referral)
  console.log('📋 Step 2: Creating Customer c-027 (Direct Partner Referral)');
  console.log('-'.repeat(60));

  results['c-027'] = await createCustomerAccount(
    'c-027@atemporal.co.uk',
    PASSWORD,
    'Customer',
    'TwentySeven',
    partnerCode
  );
  console.log('');

  const c027Code = results['c-027'].referralCode;

  // Step 3: Create Customer c-028 (customer-to-customer)
  console.log('📋 Step 3: Creating Customer c-028 (Customer→Customer Referral)');
  console.log('-'.repeat(60));

  if (c027Code) {
    results['c-028'] = await createCustomerAccount(
      'c-028@atemporal.co.uk',
      PASSWORD,
      'Customer',
      'TwentyEight',
      c027Code
    );
  } else {
    console.error('❌ Skipping c-028 - c-027 referral code not available');
    results['c-028'] = { email: 'c-028@atemporal.co.uk', userId: '', error: 'Prerequisite failed' };
  }
  console.log('');

  // Step 4: Create Customer c-029 (another direct partner referral)
  console.log('📋 Step 4: Creating Customer c-029 (Direct Partner Referral)');
  console.log('-'.repeat(60));

  results['c-029'] = await createCustomerAccount(
    'c-029@atemporal.co.uk',
    PASSWORD,
    'Customer',
    'TwentyNine',
    partnerCode
  );
  console.log('');

  const c029Code = results['c-029'].referralCode;

  // Step 5: Create Customer c-030 (multi-level: p-016 → c-029 → c-030)
  console.log('📋 Step 5: Creating Customer c-030 (Multi-Level Referral)');
  console.log('-'.repeat(60));

  if (c029Code) {
    results['c-030'] = await createCustomerAccount(
      'c-030@atemporal.co.uk',
      PASSWORD,
      'Customer',
      'Thirty',
      c029Code
    );
  } else {
    console.error('❌ Skipping c-030 - c-029 referral code not available');
    results['c-030'] = { email: 'c-030@atemporal.co.uk', userId: '', error: 'Prerequisite failed' };
  }
  console.log('');

  // Summary
  console.log('═'.repeat(60));
  console.log('📊 SUMMARY');
  console.log('═'.repeat(60));
  console.log('');

  const successful = Object.values(results).filter(r => !r.error).length;
  const failed = Object.values(results).filter(r => r.error).length;
  const total = Object.keys(results).length;

  console.log(`✅ Successful: ${successful}/${total}`);
  console.log(`❌ Failed: ${failed}/${total}`);
  console.log('');

  console.log('Account Details:');
  console.log('-'.repeat(60));

  Object.entries(results).forEach(([key, result]) => {
    if (result.error) {
      console.log(`${key}: ❌ ${result.error}`);
    } else {
      console.log(`${key}: ✅`);
      console.log(`  Email: ${result.email}`);
      console.log(`  Password: ${PASSWORD}`);
      if (result.referralCode) {
        console.log(`  Referral Code: ${result.referralCode}`);
      }
    }
    console.log('');
  });

  console.log('═'.repeat(60));
  console.log('🎯 Referral Chain:');
  console.log('═'.repeat(60));
  console.log('');
  console.log(`Partner p-016 (${partnerCode})`);
  console.log(`  ├─→ c-027 (${results['c-027']?.referralCode || 'N/A'})`);
  console.log(`  │    └─→ c-028`);
  console.log(`  └─→ c-029 (${results['c-029']?.referralCode || 'N/A'})`);
  console.log(`       └─→ c-030`);
  console.log('');
  console.log('📝 Run: npx tsx scripts/query-p016-attribution.ts to verify');
  console.log('');
}

main().catch(console.error);
