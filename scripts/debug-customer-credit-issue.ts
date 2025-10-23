import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function debugCustomerCredits() {
  const customerId = '8a26cea9-9638-4eab-aeac-2b354ca0a017';

  console.log('🔍 Checking customer credit record...\n');

  // Check if customer exists in user_profiles
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', customerId)
    .single();

  console.log('👤 Customer profile:', profile);
  if (profileError) console.error('Profile error:', profileError);

  // Check if credit record exists
  const { data: credits, error: creditsError } = await supabase
    .from('customer_customization_credits')
    .select('*')
    .eq('customer_id', customerId)
    .single();

  console.log('\n💳 Credit record:', credits);
  if (creditsError) {
    console.error('❌ Credits error:', creditsError);

    if (creditsError.code === 'PGRST116') {
      console.log('\n⚠️  No credit record exists! Creating one...');

      // Initialize credits manually
      const { data: newCredit, error: insertError } = await supabase
        .from('customer_customization_credits')
        .insert({
          customer_id: customerId,
          credits_remaining: 2,
          free_trial_credits_granted: 2,
          credits_purchased: 0,
          credits_used: 0,
          total_generations: 0
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Failed to create credit record:', insertError);
      } else {
        console.log('✅ Credit record created:', newCredit);
      }
    }
  }

  // Test the deduct function
  if (credits || creditsError?.code === 'PGRST116') {
    console.log('\n🧪 Testing credit deduction function...');

    const { data: deductResult, error: deductError } = await supabase
      .rpc('deduct_customization_credit', {
        p_customer_id: customerId,
        p_credits_to_deduct: 1
      });

    console.log('Deduct result:', deductResult);
    console.log('Deduct error:', deductError);

    if (!deductResult) {
      console.log('\n⚠️  Deduction returned FALSE. Checking balance again...');

      const { data: afterBalance } = await supabase
        .from('customer_customization_credits')
        .select('*')
        .eq('customer_id', customerId)
        .single();

      console.log('Current balance:', afterBalance);
    } else {
      console.log('✅ Credit deduction successful!');

      // Check balance after deduction
      const { data: afterBalance } = await supabase
        .from('customer_customization_credits')
        .select('*')
        .eq('customer_id', customerId)
        .single();

      console.log('Balance after deduction:', afterBalance);
    }
  }
}

debugCustomerCredits()
  .then(() => {
    console.log('\n✅ Debug complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Debug error:', error);
    process.exit(1);
  });
