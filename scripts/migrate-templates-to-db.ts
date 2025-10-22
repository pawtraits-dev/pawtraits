#!/usr/bin/env tsx

/**
 * Migrate email templates from file references to database storage
 *
 * This script:
 * 1. Reads HTML template files from lib/messaging/templates/
 * 2. Updates message_templates table to store full HTML content in email_body_template
 * 3. Makes templates editable in production (no file system dependency)
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'fs/promises';
import path from 'path';

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!serviceRoleKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Template files mapping
const templateFiles: Record<string, string> = {
  'order_confirmation': 'customer-order-confirmation.html',
  'order_shipped': 'customer-order-shipped.html',
  'partner_commission_earned': 'partner-commission-earned.html',
  'partner_approved': 'partner-approved.html'
};

async function migrateTemplates() {
  console.log('🚀 Starting template migration to database...\n');

  let migratedCount = 0;
  let errorCount = 0;

  for (const [templateKey, fileName] of Object.entries(templateFiles)) {
    try {
      console.log(`📧 Processing template: ${templateKey} (${fileName})`);

      // Read HTML file
      const filePath = path.join(process.cwd(), 'lib', 'messaging', 'templates', fileName);
      console.log(`   Reading file: ${filePath}`);

      const htmlContent = await readFile(filePath, 'utf-8');
      console.log(`   ✅ Loaded ${htmlContent.length} characters`);

      // Update database
      const { data, error } = await supabase
        .from('message_templates')
        .update({
          email_body_template: htmlContent,
          updated_at: new Date().toISOString()
        })
        .eq('template_key', templateKey)
        .select();

      if (error) {
        console.error(`   ❌ Database error:`, error.message);
        errorCount++;
        continue;
      }

      if (!data || data.length === 0) {
        console.warn(`   ⚠️  Template not found in database: ${templateKey}`);
        errorCount++;
        continue;
      }

      console.log(`   ✅ Updated database successfully`);
      console.log(`   📝 Template now contains full HTML (${htmlContent.length} chars)\n`);
      migratedCount++;

    } catch (error) {
      console.error(`   ❌ Error processing ${templateKey}:`, error);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Summary:');
  console.log('='.repeat(60));
  console.log(`✅ Successfully migrated: ${migratedCount} templates`);
  console.log(`❌ Failed: ${errorCount} templates`);
  console.log('='.repeat(60));

  if (migratedCount > 0) {
    console.log('\n✨ Templates are now stored in the database!');
    console.log('📝 You can now edit templates in the admin panel at /admin/messaging');
    console.log('🚀 Changes will work in both development and production');
  }

  if (errorCount > 0) {
    console.error('\n⚠️  Some templates failed to migrate. Check errors above.');
    process.exit(1);
  }
}

// Run migration
migrateTemplates()
  .then(() => {
    console.log('\n✅ Migration complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
