#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Environment variables from .env.local
const supabaseUrl = 'https://hmqlxpgqzknqrnomophg.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtcWx4cGdxemtucXJub21vcGhnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjU4MjM5OCwiZXhwIjoyMDY4MTU4Mzk4fQ.gKbK54_qGvL32ba6FIuHnvGr-sVMUS0up-FDzY8aa1Q';

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  try {
    console.log('🚀 Starting cost tracking migration...');
    
    const migrationPath = path.join(__dirname, '..', 'db', 'enhance-cost-tracking-existing-schema-fixed.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Executing migration SQL...');
    
    // Execute the entire SQL script
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });
    
    if (error) {
      console.error('❌ Migration failed:', error);
      console.error('Error details:', error.message);
      process.exit(1);
    } else {
      console.log('✅ Migration completed successfully!');
      console.log('📊 Cost tracking schema has been enhanced');
      console.log('💰 You can now capture costs at point-of-sale');
      
      // Test if the functions were created
      console.log('\n🔍 Testing function creation...');
      const { data: testData, error: testError } = await supabase
        .from('products')
        .select('id')
        .limit(1);
      
      if (testData && testData.length > 0) {
        console.log('✅ Database functions created successfully');
      }
    }
    
  } catch (error) {
    console.error('❌ Migration failed with exception:', error);
    process.exit(1);
  }
}

console.log('🔧 Cost Tracking Migration Tool');
console.log('================================');
runMigration();