import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing required environment variables');
  console.log('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

console.log('🔧 Using Supabase URL:', supabaseUrl);
console.log('🔐 Service role key available:', serviceRoleKey ? 'Yes' : 'No');

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function fixForeignKeyConstraint() {
  try {
    console.log('🚀 Fixing foreign key constraint for batch_job_items...');
    
    // First, drop the existing constraint
    const dropConstraintSQL = `
      ALTER TABLE batch_job_items DROP CONSTRAINT IF EXISTS batch_job_items_generated_image_id_fkey;
    `;
    
    const { error: dropError } = await supabase.rpc('execute_sql', {
      sql_query: dropConstraintSQL
    });
    
    if (dropError) {
      console.error('❌ Error dropping existing constraint:', dropError);
      return false;
    }
    
    console.log('✅ Existing constraint dropped');
    
    // Add the new constraint with ON DELETE SET NULL
    const addConstraintSQL = `
      ALTER TABLE batch_job_items 
      ADD CONSTRAINT batch_job_items_generated_image_id_fkey 
      FOREIGN KEY (generated_image_id) 
      REFERENCES image_catalog(id) 
      ON DELETE SET NULL;
    `;
    
    const { error: addError } = await supabase.rpc('execute_sql', {
      sql_query: addConstraintSQL
    });
    
    if (addError) {
      console.error('❌ Error adding new constraint:', addError);
      return false;
    }
    
    console.log('✅ New constraint added with ON DELETE SET NULL');
    
    // Add comment for documentation
    const commentSQL = `
      COMMENT ON CONSTRAINT batch_job_items_generated_image_id_fkey ON batch_job_items 
      IS 'Foreign key to image_catalog with SET NULL on delete to allow image cleanup';
    `;
    
    const { error: commentError } = await supabase.rpc('execute_sql', {
      sql_query: commentSQL
    });
    
    if (commentError) {
      console.warn('⚠️ Warning: Could not add comment (non-critical):', commentError);
    } else {
      console.log('✅ Constraint comment added');
    }
    
    console.log('🎉 Foreign key constraint fixed successfully!');
    console.log('📝 Images can now be deleted without constraint violations');
    console.log('📝 Batch job item references will be set to NULL when images are deleted');
    
    return true;
    
  } catch (error) {
    console.error('💥 Failed to fix foreign key constraint:', error);
    return false;
  }
}

// Try alternative approach if execute_sql doesn't work
async function fixConstraintAlternative() {
  console.log('🔄 Trying alternative approach...');
  
  // Test basic connectivity first
  const { data: testData, error: testError } = await supabase
    .from('batch_job_items')
    .select('count')
    .limit(1);
    
  if (testError) {
    console.error('❌ Database connection failed:', testError);
    return false;
  }
  
  console.log('✅ Database connection working');
  console.log('⚠️  Cannot execute SQL directly - please run the SQL manually:');
  console.log('');
  console.log('-- Drop existing constraint');
  console.log('ALTER TABLE batch_job_items DROP CONSTRAINT IF EXISTS batch_job_items_generated_image_id_fkey;');
  console.log('');
  console.log('-- Add new constraint with ON DELETE SET NULL');
  console.log('ALTER TABLE batch_job_items');
  console.log('ADD CONSTRAINT batch_job_items_generated_image_id_fkey');
  console.log('FOREIGN KEY (generated_image_id)');
  console.log('REFERENCES image_catalog(id)');
  console.log('ON DELETE SET NULL;');
  console.log('');
  console.log('📄 Or run the SQL file: scripts/fix-batch-job-items-fkey.sql');
  
  return true;
}

async function main() {
  console.log('🏁 Starting foreign key constraint fix...');
  
  const success = await fixForeignKeyConstraint();
  if (!success) {
    await fixConstraintAlternative();
  }
}

main();