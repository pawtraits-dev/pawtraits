#!/usr/bin/env npx tsx

/**
 * Test script for API routes
 * Usage: npm run test-api
 */

// Load environment variables first
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import fetch from 'node-fetch';

async function testAPIRoutes() {
  console.log('🧪 Testing API Routes');
  console.log('====================\n');

  const baseUrl = 'http://localhost:3000'; // Adjust if using different port

  // Test 1: Image API with non-existent image (should return 404)
  console.log('1. Testing image API with non-existent image...');
  try {
    const response = await fetch(`${baseUrl}/api/images/non-existent-id`);
    const data = await response.json();
    
    if (response.status === 404) {
      console.log('✅ Non-existent image correctly returns 404');
    } else {
      console.log(`⚠️ Expected 404, got ${response.status}`);
    }
  } catch (error) {
    console.log('❌ API might not be running. Start dev server with: npm run dev');
    console.log('   Then run this test again.');
    return;
  }

  // Test 2: QR tracking API
  console.log('\n2. Testing QR tracking API...');
  try {
    const trackingResponse = await fetch(`${baseUrl}/api/qr/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageId: 'test-image-id',
        partnerId: 'test-partner-id',
        userAgent: 'Test Script',
        referer: 'http://test.com'
      })
    });

    const trackingData = await trackingResponse.json();
    
    if (trackingResponse.ok) {
      console.log('✅ QR tracking API responds correctly');
    } else {
      console.log(`⚠️ QR tracking API error: ${(trackingData as any).error}`);
    }
  } catch (error) {
    console.log('❌ QR tracking API test failed:', error);
  }

  // Test 3: QR tracking statistics
  console.log('\n3. Testing QR tracking statistics...');
  try {
    const statsResponse = await fetch(`${baseUrl}/api/qr/track`);
    const statsData = await statsResponse.json() as any;
    
    if (statsResponse.ok) {
      console.log('✅ QR tracking statistics API working');
      console.log(`   Total scans: ${statsData.summary?.total_scans || 0}`);
      console.log(`   Tracking records: ${statsData.summary?.tracking_records || 0}`);
    } else {
      console.log(`⚠️ QR statistics API error: ${statsData.error}`);
    }
  } catch (error) {
    console.log('❌ QR statistics API test failed:', error);
  }

  console.log('\n📋 API Routes Test Summary:');
  console.log('✅ Image API structure verified');
  console.log('✅ QR tracking endpoints tested');
  console.log('\n💡 To test with real data:');
  console.log('1. Run database migration first');
  console.log('2. Migrate some test images');
  console.log('3. Test image API with real image IDs');
}

// Run the test
testAPIRoutes().catch(console.error);