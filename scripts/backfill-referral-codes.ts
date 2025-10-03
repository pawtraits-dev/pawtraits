/**
 * Backfill Script: Generate referral codes for existing users
 *
 * This script:
 * 1. Finds partners without personal_referral_code AND without pre_registration_codes
 * 2. Generates unique referral codes for them
 * 3. Finds customers without personal_referral_code
 * 4. Generates unique referral codes for them
 * 5. Optionally generates QR codes for the referral codes
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing required environment variables');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!serviceRoleKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

/**
 * Generate a unique referral code
 */
function generateReferralCode(prefix: string, length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = prefix.toUpperCase();
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Check if a code is unique
 */
async function isCodeUnique(code: string, type: 'partner' | 'customer'): Promise<boolean> {
  if (type === 'partner') {
    // Check partners.personal_referral_code
    const { data: partner } = await supabase
      .from('partners')
      .select('id')
      .eq('personal_referral_code', code)
      .single();

    if (partner) return false;

    // Check pre_registration_codes.code
    const { data: preReg } = await supabase
      .from('pre_registration_codes')
      .select('id')
      .eq('code', code)
      .single();

    return !preReg;
  } else {
    // Check customers.personal_referral_code
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('personal_referral_code', code)
      .single();

    if (customer) return false;

    // Check customer_referrals.referral_code
    const { data: custRef } = await supabase
      .from('customer_referrals')
      .select('id')
      .eq('referral_code', code)
      .single();

    return !custRef;
  }
}

/**
 * Generate unique code with retries
 */
async function generateUniqueCode(prefix: string, type: 'partner' | 'customer', maxRetries: number = 10): Promise<string | null> {
  for (let i = 0; i < maxRetries; i++) {
    const code = generateReferralCode(prefix, type === 'partner' ? 6 : 8);
    if (await isCodeUnique(code, type)) {
      return code;
    }
  }
  return null;
}

/**
 * Backfill partner referral codes
 */
async function backfillPartnerCodes() {
  console.log('\n🔍 Finding partners without referral codes...');

  // Get all partners
  const { data: allPartners, error: partnersError } = await supabase
    .from('partners')
    .select('id, business_name, first_name, last_name, email, personal_referral_code');

  if (partnersError) {
    console.error('❌ Error fetching partners:', partnersError);
    return;
  }

  console.log(`📊 Found ${allPartners?.length || 0} total partners`);

  // For each partner, check if they have a code
  let updated = 0;
  let skipped = 0;

  for (const partner of allPartners || []) {
    // Skip if already has personal_referral_code
    if (partner.personal_referral_code) {
      skipped++;
      continue;
    }

    // Check if they have pre-registration code
    const { data: preRegCodes } = await supabase
      .from('pre_registration_codes')
      .select('code')
      .eq('partner_id', partner.id);

    if (preRegCodes && preRegCodes.length > 0) {
      console.log(`⏭️  Partner ${partner.email} has pre-reg codes, skipping`);
      skipped++;
      continue;
    }

    // Generate code for this partner
    const prefix = partner.business_name
      ? partner.business_name.substring(0, 3).replace(/[^A-Z0-9]/gi, '')
      : partner.first_name.substring(0, 3);

    const code = await generateUniqueCode(prefix, 'partner');

    if (!code) {
      console.error(`❌ Could not generate unique code for partner ${partner.email}`);
      continue;
    }

    // Update partner
    const { error: updateError } = await supabase
      .from('partners')
      .update({ personal_referral_code: code })
      .eq('id', partner.id);

    if (updateError) {
      console.error(`❌ Error updating partner ${partner.email}:`, updateError);
    } else {
      console.log(`✅ Generated code ${code} for partner ${partner.email}`);
      updated++;
    }
  }

  console.log(`\n✨ Partner backfill complete:`);
  console.log(`   - Updated: ${updated}`);
  console.log(`   - Skipped: ${skipped}`);
}

/**
 * Backfill customer referral codes
 */
async function backfillCustomerCodes() {
  console.log('\n🔍 Finding customers without referral codes...');

  const { data: customers, error } = await supabase
    .from('customers')
    .select('id, first_name, last_name, email, personal_referral_code')
    .is('personal_referral_code', null);

  if (error) {
    console.error('❌ Error fetching customers:', error);
    return;
  }

  console.log(`📊 Found ${customers?.length || 0} customers without codes`);

  let updated = 0;

  for (const customer of customers || []) {
    const prefix = customer.first_name
      ? customer.first_name.substring(0, 4).replace(/[^A-Z0-9]/gi, '')
      : 'CUST';

    const code = await generateUniqueCode(prefix, 'customer');

    if (!code) {
      console.error(`❌ Could not generate unique code for customer ${customer.email}`);
      continue;
    }

    const { error: updateError } = await supabase
      .from('customers')
      .update({ personal_referral_code: code })
      .eq('id', customer.id);

    if (updateError) {
      console.error(`❌ Error updating customer ${customer.email}:`, updateError);
    } else {
      console.log(`✅ Generated code ${code} for customer ${customer.email}`);
      updated++;
    }
  }

  console.log(`\n✨ Customer backfill complete:`);
  console.log(`   - Updated: ${updated}`);
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting referral code backfill...');
  console.log('📅 ' + new Date().toISOString());

  try {
    await backfillPartnerCodes();
    await backfillCustomerCodes();

    console.log('\n✅ Backfill completed successfully!');
  } catch (error) {
    console.error('\n❌ Backfill failed:', error);
    process.exit(1);
  }
}

main();
