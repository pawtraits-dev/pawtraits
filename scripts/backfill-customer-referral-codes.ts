#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing required environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

function generateReferralCode(firstName: string, lastName: string): string {
  // Generate a referral code based on name + random characters
  const namePrefix = (firstName?.charAt(0) || '') + (lastName?.charAt(0) || '');
  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${namePrefix}${randomSuffix}`.toUpperCase();
}

async function ensureUniqueReferralCode(firstName: string, lastName: string): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const code = generateReferralCode(firstName, lastName);

    // Check if code already exists
    const { data: existing } = await supabase
      .from('customers')
      .select('id')
      .eq('personal_referral_code', code)
      .single();

    if (!existing) {
      return code;
    }

    attempts++;
  }

  // Fallback: use timestamp-based code
  const timestamp = Date.now().toString().slice(-6);
  return `REF${timestamp}`;
}

async function backfillReferralCodes() {
  console.log('🔄 Starting customer referral code backfill...');

  try {
    // Get all customers without referral codes
    const { data: customers, error: fetchError } = await supabase
      .from('customers')
      .select('id, first_name, last_name, email, personal_referral_code')
      .or('personal_referral_code.is.null,personal_referral_code.eq.""');

    if (fetchError) {
      throw new Error(`Failed to fetch customers: ${fetchError.message}`);
    }

    if (!customers || customers.length === 0) {
      console.log('✅ All customers already have referral codes!');
      return;
    }

    console.log(`📊 Found ${customers.length} customers without referral codes`);

    let successCount = 0;
    let errorCount = 0;

    for (const customer of customers) {
      try {
        console.log(`🔄 Processing customer: ${customer.email}`);

        // Generate unique referral code
        const referralCode = await ensureUniqueReferralCode(
          customer.first_name || 'Customer',
          customer.last_name || 'User'
        );

        // Update customer with referral code (only update fields that exist)
        const { error: updateError } = await supabase
          .from('customers')
          .update({
            personal_referral_code: referralCode,
            updated_at: new Date().toISOString()
          })
          .eq('id', customer.id);

        if (updateError) {
          throw new Error(`Failed to update customer: ${updateError.message}`);
        }

        console.log(`✅ Assigned referral code ${referralCode} to ${customer.email}`);
        successCount++;

      } catch (error) {
        console.error(`❌ Error processing customer ${customer.email}:`, error);
        errorCount++;
      }
    }

    console.log('\n📊 Backfill Complete:');
    console.log(`✅ Successfully processed: ${successCount} customers`);
    console.log(`❌ Errors: ${errorCount} customers`);

    if (successCount > 0) {
      console.log('\n🎉 Referral codes have been generated for existing customers!');
      console.log('💡 Customers can now access their referral codes at /referrals');
    }

  } catch (error) {
    console.error('❌ Backfill failed:', error);
    process.exit(1);
  }
}

// Run the backfill
if (require.main === module) {
  backfillReferralCodes()
    .then(() => {
      console.log('🏁 Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

export { backfillReferralCodes };