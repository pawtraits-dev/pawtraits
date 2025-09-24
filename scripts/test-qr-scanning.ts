import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testQRScanning() {
  console.log('\n🧪 Testing QR code scanning functionality...\n');

  try {
    // 1. Find a customer with a referral code
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('id, email, personal_referral_code, first_name, last_name')
      .not('personal_referral_code', 'is', null)
      .limit(1);

    if (customersError || !customers || customers.length === 0) {
      console.error('❌ No customers with referral codes found');
      return;
    }

    const testCustomer = customers[0];
    console.log(`📱 Testing with customer: ${testCustomer.email}`);
    console.log(`🎯 Referral code: ${testCustomer.personal_referral_code}`);

    // 2. Check initial QR scan count
    const { data: initialStats } = await supabase
      .from('customer_referrals')
      .select('qr_scans_count')
      .eq('referrer_customer_id', testCustomer.id);

    const initialScanCount = initialStats?.reduce((sum, r) => sum + (r.qr_scans_count || 0), 0) || 0;
    console.log(`📊 Initial QR scan count: ${initialScanCount}`);

    // 3. Simulate QR code scan by calling the verify endpoint
    console.log('\n🔍 Simulating QR code scan...');

    const response = await fetch(`http://localhost:3000/api/customer-referrals/verify/${testCustomer.personal_referral_code}`, {
      method: 'GET',
    });

    if (!response.ok) {
      console.error('❌ QR scan simulation failed:', response.status, await response.text());
      return;
    }

    const scanResult = await response.json();
    console.log('✅ QR scan successful:', scanResult.success);

    // 4. Check updated QR scan count
    const { data: updatedStats } = await supabase
      .from('customer_referrals')
      .select('qr_scans_count')
      .eq('referrer_customer_id', testCustomer.id);

    const updatedScanCount = updatedStats?.reduce((sum, r) => sum + (r.qr_scans_count || 0), 0) || 0;
    console.log(`📊 Updated QR scan count: ${updatedScanCount}`);

    if (updatedScanCount > initialScanCount) {
      console.log('✅ QR scan counting is working correctly!');
      console.log(`   Scan count increased from ${initialScanCount} to ${updatedScanCount}`);
    } else {
      console.log('❌ QR scan counting may not be working properly');
    }

    // 5. Test the customer referrals API endpoint
    console.log('\n📡 Testing customer referrals API endpoint...');

    const analyticsResponse = await fetch(`http://localhost:3000/api/referrals/customer?email=${encodeURIComponent(testCustomer.email)}`);

    if (!analyticsResponse.ok) {
      console.error('❌ Analytics API failed:', analyticsResponse.status);
      return;
    }

    const analyticsData = await analyticsResponse.json();
    console.log('✅ Analytics API response:', {
      qr_scans: analyticsData.analytics?.qr_scans,
      total_shares: analyticsData.analytics?.total_shares,
      signups: analyticsData.analytics?.signups
    });

    if (analyticsData.analytics?.qr_scans > 0) {
      console.log('🎉 QR scan tracking is working end-to-end!');
    } else {
      console.log('⚠️  QR scans not appearing in analytics API');
    }

    // 6. Do another scan to test increment
    console.log('\n🔍 Testing QR scan increment...');

    const secondResponse = await fetch(`http://localhost:3000/api/customer-referrals/verify/${testCustomer.personal_referral_code}`, {
      method: 'GET',
    });

    if (secondResponse.ok) {
      const secondAnalyticsResponse = await fetch(`http://localhost:3000/api/referrals/customer?email=${encodeURIComponent(testCustomer.email)}`);

      if (secondAnalyticsResponse.ok) {
        const secondAnalyticsData = await secondAnalyticsResponse.json();
        console.log('📊 After second scan - QR scans:', secondAnalyticsData.analytics?.qr_scans);

        if (secondAnalyticsData.analytics?.qr_scans > analyticsData.analytics?.qr_scans) {
          console.log('✅ QR scan increment is working correctly!');
        }
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testQRScanning().catch(console.error);