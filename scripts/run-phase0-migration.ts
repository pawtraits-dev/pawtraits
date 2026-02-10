/**
 * Run Phase 0 Database Migration
 *
 * Adds multi-image product support to existing schema:
 * - products.image_count field
 * - order_items.image_ids array field
 *
 * Run with: npx tsx scripts/run-phase0-migration.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration(): Promise<boolean> {
  const filename = 'phase0-add-multi-image-fields.sql';

  console.log('\n📝 Running Phase 0 Migration');
  console.log('━'.repeat(60));
  console.log(`📂 File: ${filename}`);

  try {
    const filepath = path.join(__dirname, filename);
    const sql = fs.readFileSync(filepath, 'utf8');

    console.log(`📏 SQL length: ${sql.length} characters`);
    console.log('\n🔄 Executing migration...\n');

    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('❌ Migration failed');
      console.error('Error:', error.message);
      console.error('Details:', error);
      return false;
    }

    console.log('\n✅ Migration completed successfully!');
    return true;

  } catch (error: any) {
    console.error('❌ Unexpected error during migration');
    console.error(error);
    return false;
  }
}

async function main() {
  console.log('🚀 Phase 0: Multi-Image Product Support');
  console.log('━'.repeat(60));
  console.log(`🔐 Connected to: ${supabaseUrl}`);
  console.log('━'.repeat(60));

  const success = await runMigration();

  console.log('\n' + '━'.repeat(60));
  console.log('📊 Migration Summary');
  console.log('━'.repeat(60));

  if (success) {
    console.log('✅ Phase 0 migration COMPLETE');
    console.log('\n📋 Schema Changes Applied:');
    console.log('  ✓ products.image_count: Added (default 1)');
    console.log('  ✓ order_items.image_ids: Added (text array)');
    console.log('  ✓ Indexes: Created for both fields');
    console.log('  ✓ Backfill: All existing products set to image_count = 1');
    console.log('\n🔜 Next steps:');
    console.log('  1. Create MultiImageSelector component');
    console.log('  2. Update cart context for multi-image support');
    console.log('  3. Update digital fulfillment service');
    process.exit(0);
  } else {
    console.log('❌ Migration FAILED');
    console.log('Please fix the errors and run again.');
    process.exit(1);
  }
}

// Run migration
main().catch((error) => {
  console.error('❌ Fatal error running migration:', error);
  process.exit(1);
});
