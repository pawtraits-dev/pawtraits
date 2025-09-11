#!/usr/bin/env tsx

/**
 * Debug Partner Lookup Script
 * 
 * This script investigates the partner lookup issue in the Stripe webhook.
 * It examines the relationship between user_profiles and partners tables
 * to identify why the webhook is failing to find partner records.
 * 
 * Usage: tsx scripts/debug-partner-lookup.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing environment variables:');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!serviceRoleKey);
  process.exit(1);
}

// Create service role client (bypasses RLS)
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function debugPartnerLookup() {
  console.log('🔍 PARTNER LOOKUP DEBUG ANALYSIS');
  console.log('='.repeat(50));

  try {
    // 1. Check user_profiles table for partner-type users
    console.log('\n📋 1. USER PROFILES WITH user_type="partner"');
    console.log('-'.repeat(40));
    
    const { data: partnerProfiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id, email, user_type, first_name, last_name, partner_id, created_at')
      .eq('user_type', 'partner')
      .order('created_at', { ascending: false });

    if (profilesError) {
      console.error('❌ Error fetching user profiles:', profilesError.message);
      return;
    }

    console.log(`Found ${partnerProfiles?.length || 0} user profiles with user_type='partner':`);
    partnerProfiles?.forEach((profile, index) => {
      console.log(`${index + 1}. ID: ${profile.id}`);
      console.log(`   Email: ${profile.email}`);
      console.log(`   Name: ${profile.first_name} ${profile.last_name}`);
      console.log(`   Partner ID: ${profile.partner_id}`);
      console.log(`   Created: ${profile.created_at}`);
      console.log('');
    });

    // 2. Check partners table records
    console.log('\n📋 2. PARTNERS TABLE RECORDS');
    console.log('-'.repeat(40));
    
    const { data: partnersData, error: partnersError } = await supabase
      .from('partners')
      .select('id, email, first_name, last_name, business_name, created_at')
      .order('created_at', { ascending: false });

    if (partnersError) {
      console.error('❌ Error fetching partners:', partnersError.message);
      return;
    }

    console.log(`Found ${partnersData?.length || 0} records in partners table:`);
    partnersData?.forEach((partner, index) => {
      console.log(`${index + 1}. ID: ${partner.id}`);
      console.log(`   Email: ${partner.email}`);
      console.log(`   Name: ${partner.first_name} ${partner.last_name}`);
      console.log(`   Business: ${partner.business_name || 'N/A'}`);
      console.log(`   Created: ${partner.created_at}`);
      console.log('');
    });

    // 3. Cross-reference analysis
    console.log('\n🔗 3. CROSS-REFERENCE ANALYSIS');
    console.log('-'.repeat(40));
    
    if (!partnerProfiles || !partnersData) {
      console.log('❌ Cannot perform cross-reference analysis - missing data');
      return;
    }

    // Find user_profiles without matching partners records
    const orphanedProfiles = partnerProfiles.filter(profile => 
      !partnersData.some(partner => partner.id === profile.id)
    );

    // Find partners records without matching user_profiles
    const orphanedPartners = partnersData.filter(partner => 
      !partnerProfiles.some(profile => profile.id === partner.id)
    );

    // Find email mismatches
    const emailMismatches = partnerProfiles.filter(profile => {
      const matchingPartner = partnersData.find(partner => partner.id === profile.id);
      return matchingPartner && matchingPartner.email !== profile.email;
    });

    console.log(`📊 Cross-reference results:`);
    console.log(`   User profiles without partners record: ${orphanedProfiles.length}`);
    console.log(`   Partners records without user profile: ${orphanedPartners.length}`);
    console.log(`   Email mismatches between tables: ${emailMismatches.length}`);
    console.log('');

    if (orphanedProfiles.length > 0) {
      console.log('⚠️  USER PROFILES WITHOUT PARTNERS RECORD:');
      orphanedProfiles.forEach(profile => {
        console.log(`   • ${profile.email} (ID: ${profile.id})`);
      });
      console.log('');
    }

    if (orphanedPartners.length > 0) {
      console.log('⚠️  PARTNERS RECORDS WITHOUT USER PROFILE:');
      orphanedPartners.forEach(partner => {
        console.log(`   • ${partner.email} (ID: ${partner.id})`);
      });
      console.log('');
    }

    if (emailMismatches.length > 0) {
      console.log('⚠️  EMAIL MISMATCHES:');
      emailMismatches.forEach(profile => {
        const partner = partnersData.find(p => p.id === profile.id);
        console.log(`   • Profile: ${profile.email} vs Partner: ${partner?.email} (ID: ${profile.id})`);
      });
      console.log('');
    }

    // 4. Simulate webhook lookups (CORRECTED LOGIC)
    console.log('\n🎯 4. WEBHOOK LOOKUP SIMULATION (CORRECTED)');
    console.log('-'.repeat(40));
    
    const testEmails = [
      ...new Set([
        ...partnerProfiles.map(p => p.email),
        ...partnersData.map(p => p.email)
      ])
    ].filter(email => email); // Remove null/undefined emails

    for (const email of testEmails) {
      console.log(`\n🔍 Testing webhook lookup for: ${email}`);
      
      // Step 1: Look up user_profiles (webhook line 131-136)
      const { data: profileResult, error: profileLookupError } = await supabase
        .from('user_profiles')
        .select('id, email, user_type')
        .eq('email', email)
        .eq('user_type', 'partner')
        .single();

      console.log(`   Step 1 - User profile lookup:`, {
        found: !profileLookupError && !!profileResult,
        error: profileLookupError?.message,
        result: profileResult ? `ID: ${profileResult.id}` : 'None'
      });

      if (!profileLookupError && profileResult) {
        // Step 2: Get partner_id from user_profiles (CORRECTED webhook logic)
        const { data: partnerIdResult, error: partnerIdError } = await supabase
          .from('user_profiles')
          .select('partner_id')
          .eq('id', profileResult.id)
          .single();

        console.log(`   Step 2a - Partner ID lookup:`, {
          found: !partnerIdError && !!partnerIdResult?.partner_id,
          error: partnerIdError?.message,
          result: partnerIdResult?.partner_id ? `Partner ID: ${partnerIdResult.partner_id}` : 'None'
        });

        if (!partnerIdError && partnerIdResult?.partner_id) {
          // Step 3: Look up partners table using correct partner_id (CORRECTED)
          const { data: partnerResult, error: partnerLookupError } = await supabase
            .from('partners')
            .select('id, email')
            .eq('id', partnerIdResult.partner_id)
            .single();

          console.log(`   Step 2b - Partner record lookup:`, {
            found: !partnerLookupError && !!partnerResult,
            error: partnerLookupError?.message,
            result: partnerResult ? `ID: ${partnerResult.id}` : 'None'
          });

          // Final result
          const webhookWouldSucceed = !partnerLookupError && !!partnerResult;
          console.log(`   🎯 Webhook result: ${webhookWouldSucceed ? '✅ SUCCESS' : '❌ FAIL'}`);
          
          if (!webhookWouldSucceed) {
            console.log(`   📝 Issue: ${partnerLookupError ? `Partner lookup failed: ${partnerLookupError.message}` : 'No partner record found'}`);
          }
        } else {
          console.log(`   🎯 Webhook result: ❌ FAIL (No partner_id in user_profiles)`);
        }
      } else {
        console.log(`   🎯 Webhook result: ❌ FAIL (Profile lookup failed)`);
      }
    }

    // 5. Recommendations
    console.log('\n💡 5. RECOMMENDATIONS');
    console.log('-'.repeat(40));
    
    const issues = [];
    
    if (orphanedProfiles.length > 0) {
      issues.push(`${orphanedProfiles.length} user profiles lack corresponding partners records`);
    }
    
    if (orphanedPartners.length > 0) {
      issues.push(`${orphanedPartners.length} partners records lack corresponding user profiles`);
    }
    
    if (emailMismatches.length > 0) {
      issues.push(`${emailMismatches.length} records have email mismatches between tables`);
    }

    if (issues.length === 0) {
      console.log('✅ No data integrity issues found!');
      console.log('The webhook lookup should work for all partner emails.');
    } else {
      console.log('⚠️  Issues found:');
      issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
      
      console.log('\n🔧 Suggested fixes:');
      if (orphanedProfiles.length > 0) {
        console.log('   • Create missing partners records for orphaned user profiles');
      }
      if (orphanedPartners.length > 0) {
        console.log('   • Create missing user profiles for orphaned partners records');
      }
      if (emailMismatches.length > 0) {
        console.log('   • Sync email addresses between user_profiles and partners tables');
      }
    }

    // 6. SQL fix scripts
    console.log('\n📜 6. SQL FIX SCRIPTS');
    console.log('-'.repeat(40));
    
    if (orphanedProfiles.length > 0) {
      console.log('\n-- Script to create missing partners records:');
      orphanedProfiles.forEach(profile => {
        console.log(`INSERT INTO partners (id, email, first_name, last_name, created_at, updated_at)`);
        console.log(`VALUES ('${profile.id}', '${profile.email}', '${profile.first_name}', '${profile.last_name}', NOW(), NOW());`);
      });
    }

    if (emailMismatches.length > 0) {
      console.log('\n-- Script to sync email mismatches (update partners to match user_profiles):');
      emailMismatches.forEach(profile => {
        console.log(`UPDATE partners SET email = '${profile.email}' WHERE id = '${profile.id}';`);
      });
    }

  } catch (error) {
    console.error('❌ Debug script failed:', error);
  }
}

// Run the debug analysis
debugPartnerLookup()
  .then(() => {
    console.log('\n✅ Debug analysis complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Debug script error:', error);
    process.exit(1);
  });