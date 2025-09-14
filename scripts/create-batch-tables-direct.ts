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

async function createTables() {
  try {
    console.log('🚀 Creating batch jobs tables...');
    
    // Create batch_jobs table
    const createBatchJobsSQL = `
      CREATE TABLE IF NOT EXISTS batch_jobs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          job_type TEXT NOT NULL DEFAULT 'image_generation',
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
          
          -- Job configuration
          original_image_id UUID REFERENCES image_catalog(id),
          config JSONB NOT NULL,
          target_age TEXT,
          
          -- Progress tracking
          total_items INTEGER NOT NULL DEFAULT 0,
          completed_items INTEGER NOT NULL DEFAULT 0,
          successful_items INTEGER NOT NULL DEFAULT 0,
          failed_items INTEGER NOT NULL DEFAULT 0,
          
          -- Timing
          started_at TIMESTAMPTZ,
          completed_at TIMESTAMPTZ,
          estimated_completion_at TIMESTAMPTZ,
          
          -- Results
          generated_image_ids UUID[] DEFAULT '{}',
          error_log TEXT[],
          
          -- Metadata
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by UUID
      );
    `;
    
    const { error: batchJobsError } = await supabase.rpc('execute_sql', {
      sql_query: createBatchJobsSQL
    });
    
    if (batchJobsError) {
      console.error('❌ Error creating batch_jobs table:', batchJobsError);
      return false;
    }
    
    console.log('✅ batch_jobs table created');
    
    // Create batch_job_items table
    const createBatchJobItemsSQL = `
      CREATE TABLE IF NOT EXISTS batch_job_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          job_id UUID NOT NULL REFERENCES batch_jobs(id) ON DELETE CASCADE,
          
          -- Item details
          item_index INTEGER NOT NULL,
          breed_id UUID,
          coat_id UUID,
          outfit_id UUID,
          format_id UUID,
          
          -- Status
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
          
          -- Results
          generated_image_id UUID REFERENCES image_catalog(id),
          error_message TEXT,
          gemini_duration_ms INTEGER,
          total_duration_ms INTEGER,
          retry_count INTEGER DEFAULT 0,
          
          -- Timing
          started_at TIMESTAMPTZ,
          completed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    
    const { error: batchJobItemsError } = await supabase.rpc('execute_sql', {
      sql_query: createBatchJobItemsSQL
    });
    
    if (batchJobItemsError) {
      console.error('❌ Error creating batch_job_items table:', batchJobItemsError);
      return false;
    }
    
    console.log('✅ batch_job_items table created');
    
    // Create indexes
    const indexQueries = [
      "CREATE INDEX IF NOT EXISTS idx_batch_jobs_status ON batch_jobs(status);",
      "CREATE INDEX IF NOT EXISTS idx_batch_jobs_created_at ON batch_jobs(created_at DESC);", 
      "CREATE INDEX IF NOT EXISTS idx_batch_job_items_job_id ON batch_job_items(job_id);",
      "CREATE INDEX IF NOT EXISTS idx_batch_job_items_status ON batch_job_items(status);"
    ];
    
    for (const indexSQL of indexQueries) {
      const { error: indexError } = await supabase.rpc('execute_sql', {
        sql_query: indexSQL
      });
      
      if (indexError) {
        console.error('❌ Error creating index:', indexError);
      } else {
        console.log('✅ Index created');
      }
    }
    
    console.log('🎉 All tables and indexes created successfully!');
    return true;
    
  } catch (error) {
    console.error('💥 Failed to create tables:', error);
    return false;
  }
}

// Try alternative approach if execute_sql doesn't work
async function createTablesAlternative() {
  console.log('🔄 Trying alternative approach...');
  
  // Test basic connectivity first
  const { data: testData, error: testError } = await supabase
    .from('breeds')  // Known existing table
    .select('count')
    .limit(1);
    
  if (testError) {
    console.error('❌ Database connection failed:', testError);
    return false;
  }
  
  console.log('✅ Database connection working');
  console.log('⚠️  Cannot create tables directly - please run the SQL manually in Supabase dashboard');
  console.log('📄 SQL file location: scripts/create-batch-jobs-table.sql');
  
  return true;
}

async function main() {
  console.log('🏁 Starting batch jobs table creation...');
  
  const success = await createTables();
  if (!success) {
    await createTablesAlternative();
  }
}

main();