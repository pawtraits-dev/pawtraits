#!/usr/bin/env tsx

/**
 * Load Gelato-supported countries into the database
 * All countries are initially set to inactive (is_supported = false)
 * Admins can enable specific countries through the /admin/countries interface
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function loadCountries() {
  console.log('🌍 Loading Gelato-supported countries...');
  
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'load-countries.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📂 Executing SQL script...');
    
    // Execute the SQL (note: this is a simplified approach)
    // For complex SQL with multiple statements, you might need to split and execute separately
    const { error } = await supabase.rpc('execute_sql', { sql_content: sqlContent });
    
    if (error) {
      // If RPC doesn't exist, try direct insertion (fallback method)
      console.log('⚠️  RPC method not available, trying direct insertion...');
      await loadCountriesDirectly(supabase);
      return;
    }

    console.log('✅ Countries loaded successfully via SQL script!');
    
  } catch (error) {
    console.error('❌ Error loading countries:', error);
    console.log('🔄 Trying direct insertion method...');
    await loadCountriesDirectly(supabase);
  }
}

async function loadCountriesDirectly(supabase: any) {
  const countries = [
    // Primary Markets with Local Production
    { code: 'US', name: 'United States', currency_code: 'USD', currency_symbol: '$', is_supported: false, shipping_zone: 'usa', tax_rate_percent: 0.0, display_order: 10 },
    { code: 'GB', name: 'United Kingdom', currency_code: 'GBP', currency_symbol: '£', is_supported: false, shipping_zone: 'uk_ireland', tax_rate_percent: 20.0, display_order: 20 },
    { code: 'DE', name: 'Germany', currency_code: 'EUR', currency_symbol: '€', is_supported: false, shipping_zone: 'germany', tax_rate_percent: 19.0, display_order: 30 },
    { code: 'CA', name: 'Canada', currency_code: 'CAD', currency_symbol: 'C$', is_supported: false, shipping_zone: 'canada', tax_rate_percent: 13.0, display_order: 40 },
    { code: 'AU', name: 'Australia', currency_code: 'AUD', currency_symbol: 'A$', is_supported: false, shipping_zone: 'australia_nz', tax_rate_percent: 10.0, display_order: 50 },
    { code: 'JP', name: 'Japan', currency_code: 'JPY', currency_symbol: '¥', is_supported: false, shipping_zone: 'japan', tax_rate_percent: 10.0, display_order: 60 },
    { code: 'SG', name: 'Singapore', currency_code: 'SGD', currency_symbol: 'S$', is_supported: false, shipping_zone: 'singapore', tax_rate_percent: 7.0, display_order: 70 },
    { code: 'BR', name: 'Brazil', currency_code: 'BRL', currency_symbol: 'R$', is_supported: false, shipping_zone: 'brazil', tax_rate_percent: 17.0, display_order: 80 },
    
    // Europe Region
    { code: 'FR', name: 'France', currency_code: 'EUR', currency_symbol: '€', is_supported: false, shipping_zone: 'europe', tax_rate_percent: 20.0, display_order: 140 },
    { code: 'ES', name: 'Spain', currency_code: 'EUR', currency_symbol: '€', is_supported: false, shipping_zone: 'europe', tax_rate_percent: 21.0, display_order: 150 },
    { code: 'IT', name: 'Italy', currency_code: 'EUR', currency_symbol: '€', is_supported: false, shipping_zone: 'europe', tax_rate_percent: 22.0, display_order: 160 },
    { code: 'NL', name: 'Netherlands', currency_code: 'EUR', currency_symbol: '€', is_supported: false, shipping_zone: 'europe', tax_rate_percent: 21.0, display_order: 170 },
    { code: 'BE', name: 'Belgium', currency_code: 'EUR', currency_symbol: '€', is_supported: false, shipping_zone: 'europe', tax_rate_percent: 21.0, display_order: 180 },
    { code: 'AT', name: 'Austria', currency_code: 'EUR', currency_symbol: '€', is_supported: false, shipping_zone: 'europe', tax_rate_percent: 20.0, display_order: 190 },
    { code: 'PT', name: 'Portugal', currency_code: 'EUR', currency_symbol: '€', is_supported: false, shipping_zone: 'europe', tax_rate_percent: 23.0, display_order: 200 },
    
    // Scandinavia
    { code: 'DK', name: 'Denmark', currency_code: 'DKK', currency_symbol: 'kr.', is_supported: false, shipping_zone: 'scandinavia', tax_rate_percent: 25.0, display_order: 110 },
    { code: 'NO', name: 'Norway', currency_code: 'NOK', currency_symbol: 'kr', is_supported: false, shipping_zone: 'scandinavia', tax_rate_percent: 25.0, display_order: 120 },
    { code: 'SE', name: 'Sweden', currency_code: 'SEK', currency_symbol: 'kr', is_supported: false, shipping_zone: 'scandinavia', tax_rate_percent: 25.0, display_order: 130 },
    
    // EFTA States
    { code: 'CH', name: 'Switzerland', currency_code: 'CHF', currency_symbol: 'CHF', is_supported: false, shipping_zone: 'efta', tax_rate_percent: 7.7, display_order: 470 },
    { code: 'IS', name: 'Iceland', currency_code: 'ISK', currency_symbol: 'kr', is_supported: false, shipping_zone: 'efta', tax_rate_percent: 24.0, display_order: 480 },
    
    // Additional Key Markets
    { code: 'NZ', name: 'New Zealand', currency_code: 'NZD', currency_symbol: 'NZ$', is_supported: false, shipping_zone: 'australia_nz', tax_rate_percent: 15.0, display_order: 70 },
    { code: 'IE', name: 'Ireland', currency_code: 'EUR', currency_symbol: '€', is_supported: false, shipping_zone: 'uk_ireland', tax_rate_percent: 23.0, display_order: 30 },
    
    // Major worldwide markets
    { code: 'KR', name: 'South Korea', currency_code: 'KRW', currency_symbol: '₩', is_supported: false, shipping_zone: 'worldwide', tax_rate_percent: 10.0, display_order: 500 },
    { code: 'HK', name: 'Hong Kong', currency_code: 'HKD', currency_symbol: 'HK$', is_supported: false, shipping_zone: 'worldwide', tax_rate_percent: 0.0, display_order: 510 },
    { code: 'MX', name: 'Mexico', currency_code: 'MXN', currency_symbol: '$', is_supported: false, shipping_zone: 'worldwide', tax_rate_percent: 16.0, display_order: 600 },
    { code: 'IN', name: 'India', currency_code: 'INR', currency_symbol: '₹', is_supported: false, shipping_zone: 'worldwide', tax_rate_percent: 18.0, display_order: 580 },
    { code: 'ZA', name: 'South Africa', currency_code: 'ZAR', currency_symbol: 'R', is_supported: false, shipping_zone: 'worldwide', tax_rate_percent: 15.0, display_order: 720 },
  ];

  console.log(`📥 Inserting ${countries.length} countries directly...`);

  const { error } = await supabase
    .from('countries')
    .upsert(countries, { 
      onConflict: 'code',
      ignoreDuplicates: false 
    });

  if (error) {
    console.error('❌ Error inserting countries:', error);
    throw error;
  }

  // Get summary
  const { data: summary } = await supabase
    .from('countries')
    .select('shipping_zone, is_supported')
    .order('display_order');

  const totalCount = summary?.length || 0;
  const activeCount = summary?.filter(c => c.is_supported)?.length || 0;
  
  console.log('✅ Countries loaded successfully!');
  console.log(`📊 Total countries: ${totalCount}`);
  console.log(`🟢 Active countries: ${activeCount}`);
  console.log(`⚪ Inactive countries: ${totalCount - activeCount}`);
  console.log('');
  console.log('📋 Next Steps:');
  console.log('1. Visit /admin/countries to enable countries for Gelato pricing');
  console.log('2. Countries are organized by Gelato shipping zones');
  console.log('3. Primary regions have local production facilities');
}

// Run the script
loadCountries().catch(console.error);