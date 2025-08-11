#!/usr/bin/env node

// Test script to check if the partners API endpoints work
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3001';

async function testAdminPartnersAPI() {
  console.log('🧪 Testing Admin Partners API...');
  
  try {
    // Test the partners list endpoint
    console.log('📋 Testing partners list...');
    const response = await fetch(`${BASE_URL}/api/admin/partners`);
    const data = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log('✅ Partners API working! Found', data.length, 'partners');
    } else {
      console.log('❌ Partners API error:', data.error);
    }
  } catch (error) {
    console.log('❌ Network error:', error.message);
  }
}

async function testAdminCustomersAPI() {
  console.log('\n🧪 Testing Admin Customers API...');
  
  try {
    // Test the customers list endpoint
    console.log('📋 Testing customers list...');
    const response = await fetch(`${BASE_URL}/api/admin/customers`);
    const data = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log('✅ Customers API working! Found', data.length, 'customers');
    } else {
      console.log('❌ Customers API error:', data.error);
    }
  } catch (error) {
    console.log('❌ Network error:', error.message);
  }
}

// Run tests
(async () => {
  await testAdminPartnersAPI();
  await testAdminCustomersAPI();
  process.exit(0);
})();