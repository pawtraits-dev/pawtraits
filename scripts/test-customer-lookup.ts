import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing environment variables:');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!serviceRoleKey);
  process.exit(1);
}

async function testCustomerLookup() {
  console.log('🔍 Testing customer lookup for commission debugging...');

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const testEmail = 'c-003@atemporal.co.uk';
  console.log(`📧 Looking up customer: ${testEmail}`);

  try {
    // This is the same query the webhook is doing
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select(`
        id,
        email,
        referral_type,
        referrer_id,
        referral_code_used,
        referral_discount_applied,
        referral_commission_rate,
        referral_order_id,
        created_at,
        updated_at
      `)
      .eq('email', testEmail)
      .single();

    if (customerError) {
      console.error('❌ Customer lookup error:', customerError);

      if (customerError.code === 'PGRST116') {
        console.log('📝 Customer not found - checking if they exist in customers table...');

        // Check if customer exists at all
        const { data: anyCustomer, error: anyError } = await supabase
          .from('customers')
          .select('id, email')
          .eq('email', testEmail)
          .maybeSingle();

        if (anyError) {
          console.error('❌ Error checking customer existence:', anyError);
        } else if (anyCustomer) {
          console.log('✅ Customer exists but query failed for some reason');
        } else {
          console.log('❌ Customer does not exist in customers table');
        }
      }
      return;
    }

    console.log('✅ Customer found:', {
      id: customer.id,
      email: customer.email,
      referral_type: customer.referral_type,
      referrer_id: customer.referrer_id,
      referral_code_used: customer.referral_code_used,
      has_referral_data: !!(customer.referral_type && customer.referrer_id),
      raw_referral_type: JSON.stringify(customer.referral_type),
      referral_order_id: customer.referral_order_id
    });

    // If we have a referrer_id, let's look up the partner
    if (customer.referrer_id) {
      console.log(`🔍 Looking up partner with ID: ${customer.referrer_id}`);

      const { data: partnerProfile, error: partnerError } = await supabase
        .from('user_profiles')
        .select(`
          id, email, partner_id,
          partner:partners (
            id, business_name, first_name, last_name, email,
            commission_rate, lifetime_commission_rate
          )
        `)
        .eq('id', customer.referrer_id)
        .single();

      if (partnerError) {
        console.error('❌ Partner lookup error:', partnerError);
      } else {
        console.log('✅ Partner found:', {
          id: partnerProfile.id,
          email: partnerProfile.email,
          partner_id: partnerProfile.partner_id,
          partner_data: partnerProfile.partner
        });
      }
    }

  } catch (error) {
    console.error('💥 Test failed with error:', error);
  }
}

// Run the test
testCustomerLookup().then(() => {
  console.log('🏁 Customer lookup test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test crashed:', error);
  process.exit(1);
});