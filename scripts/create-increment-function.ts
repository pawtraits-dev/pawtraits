import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function createFunction() {
  console.log('🔧 Creating increment_prereg_scan_count function...');

  const functionSQL = `
CREATE OR REPLACE FUNCTION increment_prereg_scan_count(p_code_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE pre_registration_codes
  SET
    scans_count = COALESCE(scans_count, 0) + 1,
    updated_at = NOW()
  WHERE id = p_code_id;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_prereg_scan_count(UUID) TO authenticated, anon;
  `;

  const { error } = await supabase.rpc('exec_sql' as any, { sql: functionSQL } as any);

  if (error) {
    console.error('❌ Error creating function:', error);
    console.log('\n📋 Please run this SQL manually in your Supabase SQL Editor:');
    console.log(functionSQL);
    process.exit(1);
  }

  console.log('✅ Function created successfully!');
}

createFunction();
