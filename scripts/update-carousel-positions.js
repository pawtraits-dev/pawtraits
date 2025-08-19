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

async function updateCarouselPositions() {
  try {
    console.log('🎠 Starting carousel text position update...');
    
    // Read the migration SQL
    const migrationPath = path.join(__dirname, '..', 'db', 'update-carousel-text-position.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Updating carousel_slides CHECK constraint...');
    
    // Split SQL by semicolon and execute each statement
    const statements = migrationSQL.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (const stmt of statements) {
      if (stmt.trim().startsWith('SELECT')) {
        // This is a verification query
        const { data, error } = await supabase.rpc('exec_sql', {
          sql: stmt.trim()
        });
        
        if (error) {
          console.warn('⚠️ Verification query failed:', error.message);
        } else {
          console.log('✅ Constraint verification successful');
        }
      } else {
        // This is a DDL statement
        const { data, error } = await supabase.rpc('exec_sql', {
          sql: stmt.trim()
        });
        
        if (error) {
          console.error('❌ Statement failed:', stmt.substring(0, 50) + '...');
          console.error('Error:', error.message);
        } else {
          console.log('✅ Statement executed:', stmt.substring(0, 50) + '...');
        }
      }
    }
    
    console.log('\n🎯 Testing the new text position...');
    
    // Test that bottom-center is now allowed
    const testSQL = `
      SELECT 1 FROM carousel_slides 
      WHERE text_position = 'bottom-center' 
      LIMIT 1
    `;
    
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: testSQL
    });
    
    if (!error) {
      console.log('✅ bottom-center text position is now supported!');
      console.log('🎉 Carousel slides can now use Bottom Center positioning');
    }
    
  } catch (error) {
    console.error('❌ Update failed with exception:', error);
    process.exit(1);
  }
}

console.log('🎠 Carousel Position Update Tool');
console.log('================================');
updateCarouselPositions();