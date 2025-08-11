#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase environment variables');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function runMigration() {
  try {
    console.log('Reading migration file...');
    const migrationPath = path.join(__dirname, '..', 'db', 'enhance-cost-tracking-existing-schema-fixed.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Executing migration...');
    console.log('This may take a few minutes...');
    
    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`Executing statement ${i + 1}/${statements.length}...`);
          const { data, error } = await supabase.rpc('exec_sql', {
            sql: statement
          });
          
          if (error) {
            console.error(`Error in statement ${i + 1}:`, error);
            console.error('Statement:', statement.substring(0, 100) + '...');
          } else {
            console.log(`✅ Statement ${i + 1} completed successfully`);
          }
        } catch (err) {
          console.error(`Error executing statement ${i + 1}:`, err);
          console.error('Statement:', statement.substring(0, 100) + '...');
        }
      }
    }
    
    console.log('Migration completed!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Check if dotenv is available
try {
  require('dotenv');
} catch (err) {
  console.error('dotenv package not found. Please install it:');
  console.error('npm install dotenv');
  process.exit(1);
}

runMigration();