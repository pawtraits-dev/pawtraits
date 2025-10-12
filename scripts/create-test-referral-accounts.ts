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
const BASE_URL = process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

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
const PRE_REG_CODES = ['TESTCODE010', 'TESTCODE011', 'TESTCODE012'];

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
        businessName: `${firstName}'s Pet Services`,
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

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Creating Test Referral Accounts\n');
  console.log('═'.repeat(60));
  console.log('Configuration:');
  console.log(`  Base URL: ${BASE_URL}`);
  console.log(`  Password (all accounts): ${PASSWORD}`);
  console.log(`  Pre-reg codes: ${PRE_REG_CODES.join(', ')}`);
  console.log('═'.repeat(60));
  console.log('');

  const results: Record<string, AccountResult> = {};

  // Create 3 partners with different pre-reg codes
  const partners = [
    { code: PRE_REG_CODES[0], email: 'p-020@atemporal.co.uk', num: 'Twenty' },
    { code: PRE_REG_CODES[1], email: 'p-021@atemporal.co.uk', num: 'TwentyOne' },
    { code: PRE_REG_CODES[2], email: 'p-022@atemporal.co.uk', num: 'TwentyTwo' }
  ];

  const partnerCodes: string[] = [];

  for (let i = 0; i < partners.length; i++) {
    const partner = partners[i];
    const key = `p-${20 + i}`;

    console.log(`📋 Step ${i + 1}: Creating Partner Account (${partner.code})`);
    console.log('-'.repeat(60));

    const userId = await createAuthUser(partner.email, PASSWORD, 'Partner', partner.num);
    if (userId) {
      results[key] = await createPartnerAccount(userId, partner.email, 'Partner', partner.num, partner.code);
      if (results[key].referralCode) {
        partnerCodes.push(results[key].referralCode!);
      }
    } else {
      results[key] = { email: partner.email, userId: '', error: 'Failed to create auth user' };
    }
    console.log('');
  }

  if (partnerCodes.length === 0) {
    console.error('❌ CRITICAL: No partners created successfully. Cannot continue.');
    process.exit(1);
  }

  // Use first partner for customer referrals
  const partnerReferralCode = partnerCodes[0];
  console.log(`Using ${partnerReferralCode} for customer referrals\n`);

  // Step 4: Create Customer c-012 (direct partner referral)
  console.log('📋 Step 4: Creating Customer c-012 (Direct Partner Referral)');
  console.log('-'.repeat(60));

  results['c-012'] = await createCustomerAccount(
    'c-012@atemporal.co.uk',
    PASSWORD,
    'Customer',
    'Twelve',
    partnerReferralCode
  );

  console.log('');

  if (!results['c-012'].referralCode) {
    console.error('❌ WARNING: Customer c-012 creation failed');
  }

  const c012ReferralCode = results['c-012'].referralCode;

  // Step 5: Create Customer c-013 (customer-to-customer referral)
  console.log('📋 Step 5: Creating Customer c-013 (Customer→Customer Referral)');
  console.log('-'.repeat(60));

  if (c012ReferralCode) {
    results['c-013'] = await createCustomerAccount(
      'c-013@atemporal.co.uk',
      PASSWORD,
      'Customer',
      'Thirteen',
      c012ReferralCode
    );
  } else {
    console.error('❌ Skipping c-013 - c-012 referral code not available');
    results['c-013'] = { email: 'c-013@atemporal.co.uk', userId: '', error: 'Prerequisite failed' };
  }

  console.log('');

  const c013ReferralCode = results['c-013'].referralCode;

  // Step 6: Create Customer c-014 (another direct partner referral)
  console.log('📋 Step 6: Creating Customer c-014 (Direct Partner Referral)');
  console.log('-'.repeat(60));

  results['c-014'] = await createCustomerAccount(
    'c-014@atemporal.co.uk',
    PASSWORD,
    'Customer',
    'Fourteen',
    partnerReferralCode
  );

  console.log('');

  // Step 7: Create Customer c-015 (multi-level: p-020 → c-012 → c-013 → c-015)
  console.log('📋 Step 7: Creating Customer c-015 (Multi-Level Referral)');
  console.log('-'.repeat(60));

  if (c013ReferralCode) {
    results['c-015'] = await createCustomerAccount(
      'c-015@atemporal.co.uk',
      PASSWORD,
      'Customer',
      'Fifteen',
      c013ReferralCode
    );
  } else {
    console.error('❌ Skipping c-015 - c-013 referral code not available');
    results['c-015'] = { email: 'c-015@atemporal.co.uk', userId: '', error: 'Prerequisite failed' };
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
  console.log('📝 Next Steps:');
  console.log('═'.repeat(60));
  console.log('1. Check scripts/TEST-REFERRAL-ACCOUNTS.md for testing instructions');
  console.log('2. Place orders as each customer to test the referral system');
  console.log('3. Verify commissions, credits, and discounts in admin dashboard');
  console.log('');
  console.log('🎯 Referral Chains:');
  console.log(`   Partner p-020 (${PRE_REG_CODES[0]} → ${results['p-20']?.referralCode || 'N/A'})`);
  console.log(`   Partner p-021 (${PRE_REG_CODES[1]} → ${results['p-21']?.referralCode || 'N/A'})`);
  console.log(`   Partner p-022 (${PRE_REG_CODES[2]} → ${results['p-22']?.referralCode || 'N/A'})`);
  console.log('');
  console.log(`   p-020 (${partnerReferralCode})`);
  console.log(`     ├─→ c-012 (${results['c-012']?.referralCode || 'N/A'})`);
  console.log(`     │    └─→ c-013 (${results['c-013']?.referralCode || 'N/A'})`);
  console.log(`     │         └─→ c-015`);
  console.log(`     └─→ c-014`);
  console.log('');
}

main().catch(console.error);
