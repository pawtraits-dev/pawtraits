/**
 * Create Test Referral Accounts
 *
 * This script creates a complete test setup for referral system testing including:
 * - 1 Partner account (from pre-registration code)
 * - 4 Customer accounts with referral chains
 *
 * Run with: npx tsx scripts/create-test-referral-accounts.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

// Validate required environment variables
if (!SUPABASE_URL) {
  console.error('❌ ERROR: NEXT_PUBLIC_SUPABASE_URL not found in environment variables');
  console.error('   Make sure .env.local exists in the project root');
  process.exit(1);
}

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ ERROR: SUPABASE_SERVICE_ROLE_KEY not found in environment variables');
  console.error('   Make sure .env.local exists in the project root');
  process.exit(1);
}

// Test account credentials
const PASSWORD = '!@£QWE123qwe';
const PRE_REG_CODE = 'TESTCODE004';

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

/**
 * Create a Supabase auth user
 */
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

/**
 * Create partner account via API
 */
async function createPartnerAccount(
  userId: string,
  email: string,
  firstName: string,
  lastName: string
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
        businessName: `${firstName}'s Pet Services`,
        businessType: 'groomer',
        preRegCode: PRE_REG_CODE
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

/**
 * Create customer account via API
 */
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
    console.log(`   Customer ID: ${data.customer.id}`);
    console.log(`   Personal code: ${data.customer.personal_referral_code}`);
    if (referralCode) {
      console.log(`   Used referral code: ${referralCode}`);
    }

    return {
      email,
      userId: data.customer.id,
      referralCode: data.customer.personal_referral_code
    };
  } catch (error) {
    console.error(`❌ Error creating customer ${email}:`, error);
    return { email, userId: '', error: String(error) };
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Creating Test Referral Accounts\n');
  console.log('═'.repeat(60));
  console.log('Configuration:');
  console.log(`  Base URL: ${BASE_URL}`);
  console.log(`  Password (all accounts): ${PASSWORD}`);
  console.log(`  Pre-reg code: ${PRE_REG_CODE}`);
  console.log('═'.repeat(60));
  console.log('');

  const results: Record<string, AccountResult> = {};

  // Step 1: Create Partner p-013
  console.log('📋 Step 1: Creating Partner Account');
  console.log('-'.repeat(60));

  const p013UserId = await createAuthUser('p-013@atemporal.co.uk', PASSWORD, 'Partner', 'Thirteen');
  if (p013UserId) {
    results['p-013'] = await createPartnerAccount(p013UserId, 'p-013@atemporal.co.uk', 'Partner', 'Thirteen');
  } else {
    results['p-013'] = { email: 'p-013@atemporal.co.uk', userId: '', error: 'Failed to create auth user' };
  }

  console.log('');

  if (!results['p-013'].referralCode) {
    console.error('❌ CRITICAL: Partner creation failed. Cannot continue.');
    process.exit(1);
  }

  const partnerReferralCode = results['p-013'].referralCode!;

  // Step 2: Create Customer c-013 (direct partner referral)
  console.log('📋 Step 2: Creating Customer c-013 (Direct Partner Referral)');
  console.log('-'.repeat(60));

  results['c-013'] = await createCustomerAccount(
    'c-013@atemporal.co.uk',
    PASSWORD,
    'Customer',
    'Thirteen',
    partnerReferralCode
  );

  console.log('');

  if (!results['c-013'].referralCode) {
    console.error('❌ WARNING: Customer c-013 creation failed');
  }

  const c013ReferralCode = results['c-013'].referralCode;

  // Step 3: Create Customer c-014 (customer-to-customer referral)
  console.log('📋 Step 3: Creating Customer c-014 (Customer→Customer Referral)');
  console.log('-'.repeat(60));

  if (c013ReferralCode) {
    results['c-014'] = await createCustomerAccount(
      'c-014@atemporal.co.uk',
      PASSWORD,
      'Customer',
      'Fourteen',
      c013ReferralCode
    );
  } else {
    console.error('❌ Skipping c-014 - c-013 referral code not available');
    results['c-014'] = { email: 'c-014@atemporal.co.uk', userId: '', error: 'Prerequisite failed' };
  }

  console.log('');

  const c014ReferralCode = results['c-014'].referralCode;

  // Step 4: Create Customer c-015 (another direct partner referral)
  console.log('📋 Step 4: Creating Customer c-015 (Direct Partner Referral)');
  console.log('-'.repeat(60));

  results['c-015'] = await createCustomerAccount(
    'c-015@atemporal.co.uk',
    PASSWORD,
    'Customer',
    'Fifteen',
    partnerReferralCode
  );

  console.log('');

  // Step 5: Create Customer c-016 (multi-level: p-013 → c-013 → c-014 → c-016)
  console.log('📋 Step 5: Creating Customer c-016 (Multi-Level Referral)');
  console.log('-'.repeat(60));

  if (c014ReferralCode) {
    results['c-016'] = await createCustomerAccount(
      'c-016@atemporal.co.uk',
      PASSWORD,
      'Customer',
      'Sixteen',
      c014ReferralCode
    );
  } else {
    console.error('❌ Skipping c-016 - c-014 referral code not available');
    results['c-016'] = { email: 'c-016@atemporal.co.uk', userId: '', error: 'Prerequisite failed' };
  }

  console.log('');

  // Summary
  console.log('═'.repeat(60));
  console.log('📊 SUMMARY');
  console.log('═'.repeat(60));
  console.log('');

  const successful = Object.values(results).filter(r => !r.error).length;
  const failed = Object.values(results).filter(r => r.error).length;

  console.log(`✅ Successful: ${successful}/5`);
  console.log(`❌ Failed: ${failed}/5`);
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
  console.log('📝 Next Steps:');
  console.log('═'.repeat(60));
  console.log('1. Check scripts/TEST-REFERRAL-ACCOUNTS.md for testing instructions');
  console.log('2. Place orders as each customer to test the referral system');
  console.log('3. Verify commissions, credits, and discounts in admin dashboard');
  console.log('');
  console.log('🎯 Referral Chain:');
  console.log(`   p-013 (${partnerReferralCode})`);
  console.log(`     ├─→ c-013 (${results['c-013'].referralCode || 'N/A'})`);
  console.log(`     │    └─→ c-014 (${results['c-014'].referralCode || 'N/A'})`);
  console.log(`     │         └─→ c-016`);
  console.log(`     └─→ c-015`);
  console.log('');
}

main().catch(console.error);
