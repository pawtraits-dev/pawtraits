import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync } from 'fs';

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function runSQL(sqlFile: string) {
  try {
    console.log(`\n🔧 Running SQL file: ${sqlFile}`);

    const sql = readFileSync(sqlFile, 'utf8');
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (!statement) continue;

      console.log(`\n[${i + 1}/${statements.length}] Executing statement...`);
      console.log(statement.substring(0, 100) + (statement.length > 100 ? '...' : ''));

      const { error } = await supabase.rpc('exec_sql', { sql_query: statement });

      if (error) {
        console.error(`❌ Error in statement ${i + 1}:`, error.message);
        throw error;
      }

      console.log(`✅ Statement ${i + 1} completed`);
    }

    console.log('\n🎉 All SQL statements executed successfully!');

  } catch (error) {
    console.error('❌ SQL execution failed:', error);
    throw error;
  }
}

if (process.argv.length < 3) {
  console.error('Usage: tsx run-sql.ts <sql-file>');
  process.exit(1);
}

const sqlFile = process.argv[2];
runSQL(sqlFile).catch(console.error);