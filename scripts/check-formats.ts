import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function checkFormats() {
  const { data: formats, error } = await supabase
    .from('formats')
    .select('id, name, aspect_ratio, description')
    .order('name');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n📐 Formats in database:\n');
  formats?.forEach(format => {
    console.log(`${format.name.padEnd(25)} | Aspect Ratio: ${format.aspect_ratio || 'NULL'}`);
  });
}

checkFormats();
