import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function initializeExistingCustomerCredits() {
  console.log('🔍 Finding customers without credit records...\n');

  // Get all customers
  const { data: customers, error: customersError } = await supabase
    .from('user_profiles')
    .select('id, email, first_name, last_name, created_at')
    .eq('user_type', 'customer')
    .order('created_at', { ascending: false });

  if (customersError) {
    console.error('❌ Error fetching customers:', customersError);
    return;
  }

  console.log(`📊 Found ${customers.length} total customers\n`);

  // Check which ones don't have credit records
  const customersNeedingCredits: any[] = [];

  for (const customer of customers) {
    const { data: creditRecord, error: creditError } = await supabase
      .from('customer_customization_credits')
      .select('id')
      .eq('customer_id', customer.id)
      .maybeSingle();

    if (!creditRecord) {
      customersNeedingCredits.push(customer);
    }
  }

  console.log(`⚠️  ${customersNeedingCredits.length} customers need credit initialization\n`);

  if (customersNeedingCredits.length === 0) {
    console.log('✅ All customers already have credit records!');
    return;
  }

  // Display customers needing initialization
  console.log('Customers to initialize:');
  customersNeedingCredits.forEach((c, i) => {
    console.log(`${i + 1}. ${c.email} (${c.first_name} ${c.last_name}) - created ${c.created_at}`);
  });

  console.log('\n💳 Initializing credit records...\n');

  // Initialize credits for each customer
  let successCount = 0;
  let errorCount = 0;

  for (const customer of customersNeedingCredits) {
    const { data: newCredit, error: insertError } = await supabase
      .from('customer_customization_credits')
      .insert({
        customer_id: customer.id,
        credits_remaining: 2,
        free_trial_credits_granted: 2,
        credits_purchased: 0,
        credits_used: 0,
        total_generations: 0,
        total_spent_amount: 0
      })
      .select()
      .single();

    if (insertError) {
      console.error(`❌ Failed for ${customer.email}:`, insertError.message);
      errorCount++;
    } else {
      console.log(`✅ Initialized for ${customer.email} - 2 free credits granted`);
      successCount++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`✅ Success: ${successCount} customers`);
  console.log(`❌ Errors: ${errorCount} customers`);
  console.log(`💳 Total credits granted: ${successCount * 2} credits`);
}

initializeExistingCustomerCredits()
  .then(() => {
    console.log('\n✅ Migration complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration error:', error);
    process.exit(1);
  });
