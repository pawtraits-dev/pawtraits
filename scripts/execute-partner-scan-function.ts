/**
 * Execute SQL to create increment_partner_referral_scans RPC function
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  console.log('Creating increment_partner_referral_scans RPC function...\n');

  // Create the RPC function
  const sql = `
    CREATE OR REPLACE FUNCTION increment_partner_referral_scans(p_partner_id UUID)
    RETURNS VOID AS $$
    BEGIN
      UPDATE partners
      SET referral_scans_count = COALESCE(referral_scans_count, 0) + 1
      WHERE id = p_partner_id;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    -- Grant execute permissions
    GRANT EXECUTE ON FUNCTION increment_partner_referral_scans(UUID) TO authenticated, anon;
  `;

  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    // Try direct execution
    console.log('Attempting direct SQL execution via service role...\n');

    // Split into separate statements
    const statements = [
      `CREATE OR REPLACE FUNCTION increment_partner_referral_scans(p_partner_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE partners
  SET referral_scans_count = COALESCE(referral_scans_count, 0) + 1
  WHERE id = p_partner_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`,
      `GRANT EXECUTE ON FUNCTION increment_partner_referral_scans(UUID) TO authenticated, anon;`
    ];

    console.log('⚠️  Cannot create RPC function via Supabase client.');
    console.log('Please execute the following SQL manually in Supabase SQL Editor:\n');
    console.log('----------------------------------------');
    statements.forEach(stmt => console.log(stmt + '\n'));
    console.log('----------------------------------------\n');

    process.exit(1);
  }

  console.log('✅ Successfully created increment_partner_referral_scans RPC function');
}

main();
