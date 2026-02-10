/**
 * Run Phase 1 Database Migrations
 *
 * Extends database schema to support multi-fulfillment product system:
 * - Digital downloads
 * - Manual fulfillment
 * - Multiple POD API suppliers
 *
 * Run with: tsx scripts/run-phase1-migrations.ts
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

// Migration files in execution order
const migrationFiles = [
  'phase1-01-extend-products-table.sql',
  'phase1-02-extend-orders-table.sql',
  'phase1-03-extend-order-items-table.sql',
  'phase1-04-create-order-fulfillment-tracking-table.sql',
  'phase1-05-backfill-existing-data.sql'
];

async function runMigration(filename: string): Promise<boolean> {
  console.log(`\n📝 Running migration: ${filename}`);
  console.log('━'.repeat(60));

  try {
    const filepath = path.join(__dirname, filename);
    const sql = fs.readFileSync(filepath, 'utf8');

    console.log(`📂 Reading SQL from: ${filepath}`);
    console.log(`📏 SQL length: ${sql.length} characters`);

    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error(`❌ Migration failed: ${filename}`);
      console.error('Error:', error.message);
      console.error('Details:', error);
      return false;
    }

    console.log(`✅ Migration completed: ${filename}`);
    return true;

  } catch (error: any) {
    console.error(`❌ Unexpected error in migration: ${filename}`);
    console.error(error);
    return false;
  }
}

async function runAllMigrations() {
  console.log('🚀 Starting Phase 1 Database Migrations');
  console.log('━'.repeat(60));
  console.log(`📊 Total migrations: ${migrationFiles.length}`);
  console.log(`🔐 Connected to: ${supabaseUrl}`);
  console.log('━'.repeat(60));

  let successCount = 0;
  let failureCount = 0;

  for (const filename of migrationFiles) {
    const success = await runMigration(filename);

    if (success) {
      successCount++;
    } else {
      failureCount++;
      console.error(`\n⚠️  Migration failed, stopping execution.`);
      break;
    }
  }

  console.log('\n' + '━'.repeat(60));
  console.log('📊 Migration Summary');
  console.log('━'.repeat(60));
  console.log(`✅ Successful: ${successCount}/${migrationFiles.length}`);
  console.log(`❌ Failed: ${failureCount}`);

  if (failureCount === 0) {
    console.log('\n🎉 All Phase 1 migrations completed successfully!');
    console.log('\n📋 Schema Changes Applied:');
    console.log('  ✓ Products table: product_type, fulfillment_method, digital fields');
    console.log('  ✓ Orders table: fulfillment_type, fulfillment_status, digital_delivery_status');
    console.log('  ✓ Order items table: is_digital, download tracking fields');
    console.log('  ✓ New table: order_fulfillment_tracking');
    console.log('  ✓ Existing data backfilled with defaults');
    console.log('\n🔜 Next steps:');
    console.log('  1. Verify schema with: tsx scripts/update-schema-file.ts');
    console.log('  2. Begin service layer implementation');
    console.log('  3. Create digital product admin UI');
    process.exit(0);
  } else {
    console.log('\n❌ Migration process incomplete due to errors.');
    console.log('Please fix the errors and run again.');
    process.exit(1);
  }
}

// Run migrations
runAllMigrations().catch((error) => {
  console.error('❌ Fatal error running migrations:', error);
  process.exit(1);
});
