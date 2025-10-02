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

async function testWebhookCommissionFlow() {
  console.log('🧪 Testing webhook commission processing flow...');

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const testCustomerEmail = 'c-003@atemporal.co.uk';
  console.log(`📧 Testing customer: ${testCustomerEmail}`);

  try {
    // Step 1: Test customer lookup (simulating webhook logic)
    console.log('\n🔍 Step 1: Customer lookup');
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
      .eq('email', testCustomerEmail.toLowerCase())
      .single();

    if (customerError) {
      console.error('❌ Customer lookup failed:', customerError);
      return;
    }

    console.log('✅ Customer found:', {
      id: customer.id,
      email: customer.email,
      referral_type: customer.referral_type,
      referrer_id: customer.referrer_id,
      has_referral_data: !!(customer.referral_type && customer.referrer_id)
    });

    // Step 2: Test partner lookup if referral exists
    if (customer.referrer_id && customer.referral_type === 'PARTNER') {
      console.log('\n👥 Step 2: Partner lookup');
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
        console.error('❌ Partner lookup failed:', partnerError);
        return;
      }

      console.log('✅ Partner found:', {
        id: partnerProfile.id,
        email: partnerProfile.email,
        partner_business: partnerProfile.partner?.business_name,
        commission_rate: partnerProfile.partner?.commission_rate
      });

      // Step 3: Simulate commission creation
      console.log('\n💰 Step 3: Commission calculation');
      const testOrderValue = 50.00;
      const commissionRatePercent = partnerProfile.partner?.commission_rate || 10.00;
      const commissionRateDecimal = commissionRatePercent / 100; // Convert 10.00 -> 0.10
      const commissionAmount = testOrderValue * commissionRateDecimal;

      console.log('💡 Commission calculation:', {
        order_value: `£${testOrderValue.toFixed(2)}`,
        commission_rate_stored: `${commissionRatePercent.toFixed(2)}%`,
        commission_rate_decimal: commissionRateDecimal.toFixed(4),
        commission_amount: `£${commissionAmount.toFixed(2)}`
      });

      console.log('\n✅ Webhook commission flow simulation complete!');
      console.log('🎯 Expected behavior: Webhook should create commission with these values');

    } else {
      console.log('\n❌ No partner referral data found - commission creation would be skipped');
    }

    // Step 4: Check existing commissions for this customer
    console.log('\n📊 Step 4: Checking existing commissions');
    const { data: existingCommissions, error: commissionError } = await supabase
      .from('commissions')
      .select(`
        id, recipient_type, recipient_id, recipient_email, order_id,
        commission_amount, commission_rate, status, created_at, metadata
      `)
      .or(`recipient_email.eq.${testCustomerEmail.toLowerCase()},metadata->>customer_email.eq.${testCustomerEmail.toLowerCase()}`);

    // Also check for partner commissions related to this customer
    console.log('\n🔍 Step 4b: Checking partner commissions for referrals from this customer');
    if (customer.referrer_id) {
      const { data: partnerCommissions, error: partnerCommissionError } = await supabase
        .from('commissions')
        .select(`
          id, recipient_type, recipient_id, recipient_email, order_id,
          commission_amount, commission_rate, status, created_at, metadata
        `)
        .eq('recipient_id', customer.referrer_id)
        .eq('recipient_type', 'partner');

      if (partnerCommissionError) {
        console.error('❌ Partner commission lookup failed:', partnerCommissionError);
      } else {
        console.log(`📈 Found ${partnerCommissions?.length || 0} partner commissions for referrer ${customer.referrer_id}`);
        if (partnerCommissions && partnerCommissions.length > 0) {
          partnerCommissions.forEach((commission, index) => {
            console.log(`  ${index + 1}. Order: ${commission.order_id}, Amount: £${(commission.commission_amount / 100).toFixed(2)}, Status: ${commission.status}`);
          });
        }
      }
    }

    if (commissionError) {
      console.error('❌ Commission lookup failed:', commissionError);
    } else {
      console.log(`💼 Found ${existingCommissions?.length || 0} existing commissions for this customer`);
      if (existingCommissions && existingCommissions.length > 0) {
        existingCommissions.forEach((commission, index) => {
          console.log(`  ${index + 1}. Order: ${commission.order_id}, Amount: £${commission.commission_amount}, Status: ${commission.status}`);
        });
      }
    }

  } catch (error) {
    console.error('💥 Test failed with error:', error);
  }
}

// Run the test
testWebhookCommissionFlow().then(() => {
  console.log('\n🏁 Webhook commission test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test crashed:', error);
  process.exit(1);
});