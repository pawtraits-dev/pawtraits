import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function addQRScansField() {
  try {
    console.log('\n🔧 Adding qr_scans_count field to customer_referrals table...');

    // Add the field using direct SQL insert
    const { data, error } = await supabase
      .from('customer_referrals')
      .select('id')
      .limit(1);

    if (error) {
      console.error('❌ Error accessing customer_referrals table:', error);
      return;
    }

    console.log('✅ customer_referrals table exists');

    // Add the column using raw SQL
    // First, let's try to alter the table structure by inserting a test record
    // This is a workaround since we can't run ALTER TABLE directly

    console.log('📝 The qr_scans_count field should be added manually to the customer_referrals table');
    console.log('   You can do this through the Supabase dashboard:');
    console.log('   1. Go to Table Editor');
    console.log('   2. Select customer_referrals table');
    console.log('   3. Add new column:');
    console.log('      - Name: qr_scans_count');
    console.log('      - Type: int4 (integer)');
    console.log('      - Default value: 0');
    console.log('      - Allow nullable: false');

    console.log('\n📊 For now, let me check what fields exist in customer_referrals:');

    // Check existing table structure by examining a record
    const { data: sampleData, error: sampleError } = await supabase
      .from('customer_referrals')
      .select('*')
      .limit(1);

    if (sampleData && sampleData.length > 0) {
      console.log('📋 Current fields in customer_referrals:', Object.keys(sampleData[0]));

      if ('qr_scans_count' in sampleData[0]) {
        console.log('✅ qr_scans_count field already exists!');
      } else {
        console.log('❌ qr_scans_count field does not exist - needs to be added manually');
      }
    } else {
      console.log('📋 No records found in customer_referrals table');
    }

    // Test if we can insert with qr_scans_count field
    console.log('\n🧪 Testing if qr_scans_count field accepts data...');

    const testCode = `TEST${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    try {
      const { data: testInsert, error: insertError } = await supabase
        .from('customer_referrals')
        .insert({
          referrer_customer_id: '00000000-0000-0000-0000-000000000000', // Dummy ID
          referral_code: testCode,
          status: 'pending',
          qr_scans_count: 1
        })
        .select()
        .single();

      if (insertError) {
        console.log('❌ qr_scans_count field does not exist or has issues:', insertError.message);
      } else {
        console.log('✅ qr_scans_count field works correctly!');

        // Clean up test record
        await supabase
          .from('customer_referrals')
          .delete()
          .eq('referral_code', testCode);

        console.log('🧹 Cleaned up test record');
      }
    } catch (err) {
      console.log('❌ Insert test failed:', err);
    }

  } catch (error) {
    console.error('❌ Failed to add QR scans field:', error);
  }
}

addQRScansField().catch(console.error);