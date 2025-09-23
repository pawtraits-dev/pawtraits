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

async function addReferralColumns() {
  console.log('🔄 Adding referral tracking columns to customers table...');

  try {
    // Add the missing columns to the customers table
    const { error: sqlError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Add referral tracking columns to customers table
        ALTER TABLE customers
        ADD COLUMN IF NOT EXISTS total_referrals INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS successful_referrals INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS rewards_earned DECIMAL(10,2) DEFAULT 0.00,
        ADD COLUMN IF NOT EXISTS signup_discount_used INTEGER DEFAULT 0;

        -- Update existing customers to have default values
        UPDATE customers
        SET
          total_referrals = COALESCE(total_referrals, 0),
          successful_referrals = COALESCE(successful_referrals, 0),
          rewards_earned = COALESCE(rewards_earned, 0.00),
          signup_discount_used = COALESCE(signup_discount_used, 0)
        WHERE
          total_referrals IS NULL
          OR successful_referrals IS NULL
          OR rewards_earned IS NULL
          OR signup_discount_used IS NULL;
      `
    });

    if (sqlError) {
      throw new Error(`SQL execution failed: ${sqlError.message}`);
    }

    console.log('✅ Successfully added referral tracking columns to customers table');

    // Verify the columns were added
    const { data: customers, error: fetchError } = await supabase
      .from('customers')
      .select('id, email, personal_referral_code, total_referrals, successful_referrals, rewards_earned, signup_discount_used')
      .limit(5);

    if (fetchError) {
      throw new Error(`Verification failed: ${fetchError.message}`);
    }

    console.log('\n📊 Sample customers with new columns:');
    customers?.forEach(customer => {
      console.log(`  ${customer.email}: ${customer.personal_referral_code} (refs: ${customer.total_referrals}, rewards: $${customer.rewards_earned})`);
    });

    console.log('\n🎉 Database migration completed successfully!');
    console.log('💡 The customers table now supports full referral tracking functionality.');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  addReferralColumns()
    .then(() => {
      console.log('🏁 Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

export { addReferralColumns };