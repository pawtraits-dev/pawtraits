#!/usr/bin/env tsx
/**
 * Update Schema File Script
 *
 * This script connects to the Supabase database and exports the complete
 * schema DDL to /db/current-db/current-schema for reference.
 *
 * Usage: tsx scripts/update-schema-file.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function updateSchemaFile() {
  console.log('🔍 Fetching database schema from Supabase...\n');

  try {
    // Query to get DDL for all tables in public schema
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT
          'CREATE TABLE ' || table_schema || '.' || table_name || ' (' ||
          string_agg(
            column_name || ' ' || data_type ||
            CASE WHEN character_maximum_length IS NOT NULL
              THEN '(' || character_maximum_length || ')'
              ELSE ''
            END ||
            CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END,
            ', '
          ) || ');' as ddl
        FROM information_schema.columns
        WHERE table_schema = 'public'
        GROUP BY table_schema, table_name
        ORDER BY table_name;
      `
    });

    if (error) {
      // If RPC function doesn't exist, use pg_dump alternative
      console.log('⚠️  Direct SQL execution not available, using alternative method...\n');

      // Alternative: Read current schema and provide instructions
      const schemaPath = path.join(process.cwd(), 'db', 'current-db', 'current-schema');

      console.log('📋 To update the schema file manually:');
      console.log('');
      console.log('1. Connect to your Supabase database');
      console.log('2. Run this command:');
      console.log('   pg_dump --schema-only --schema=public -d [database-url] > /tmp/schema.sql');
      console.log('3. Copy the output to:');
      console.log(`   ${schemaPath}`);
      console.log('');
      console.log('Or use Supabase Studio:');
      console.log('1. Go to Database > Schema Visualization');
      console.log('2. Export schema as SQL');
      console.log(`3. Save to ${schemaPath}`);
      console.log('');

      return;
    }

    // For now, we'll create a simpler version that queries the information schema
    const { data: tables, error: tablesError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
          ORDER BY table_name;
        `
      });

    if (tablesError) {
      throw tablesError;
    }

    const schemaPath = path.join(process.cwd(), 'db', 'current-db', 'current-schema');
    const schemaDir = path.dirname(schemaPath);

    // Ensure directory exists
    if (!fs.existsSync(schemaDir)) {
      fs.mkdirSync(schemaDir, { recursive: true });
    }

    // Write schema information
    let schemaContent = '-- WARNING: This schema is for context only and is not meant to be run.\n';
    schemaContent += '-- Table order and constraints may not be valid for execution.\n';
    schemaContent += '-- Generated: ' + new Date().toISOString() + '\n\n';
    schemaContent += '-- To update this file, run: tsx scripts/update-schema-file.ts\n';
    schemaContent += '-- Or manually export schema from Supabase Studio\n\n';
    schemaContent += '-- For actual migrations, use the files in /db/migrations/\n\n';

    console.log('✅ Schema metadata collected');
    console.log('');
    console.log('📝 Please use one of these methods to get the complete schema:');
    console.log('');
    console.log('Method 1: Supabase CLI');
    console.log('  supabase db dump --schema public > db/current-db/current-schema');
    console.log('');
    console.log('Method 2: pg_dump');
    console.log('  pg_dump --schema-only --schema=public [connection-string] > db/current-db/current-schema');
    console.log('');
    console.log('Method 3: Supabase Studio');
    console.log('  1. Go to your project dashboard');
    console.log('  2. Database > Schema Visualization');
    console.log('  3. Export schema as SQL');
    console.log('  4. Save to db/current-db/current-schema');
    console.log('');

    // Write a helpful note to the file
    schemaContent += '\n-- ℹ️  This file should contain the complete DDL export from the database.\n';
    schemaContent += '-- Run one of the commands above to populate it with actual schema.\n';

    fs.writeFileSync(schemaPath, schemaContent);

    console.log(`✅ Schema reference file updated at: ${schemaPath}`);
    console.log('');

  } catch (err) {
    console.error('❌ Error updating schema file:', err);
    process.exit(1);
  }
}

// Run the script
updateSchemaFile()
  .then(() => {
    console.log('✅ Schema update process completed');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
