import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables - try multiple env files
const envFiles = ['.env.local', '.env', '.env.production'];
let envLoaded = false;

for (const envFile of envFiles) {
  const envPath = path.join(__dirname, '..', envFile);
  if (fs.existsSync(envPath)) {
    console.log(`📋 Loading environment from ${envFile}...`);
    dotenv.config({ path: envPath });
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  console.log('⚠️  No .env file found, using process environment variables');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function addAIAnalysisColumn() {
  console.log('📊 Adding AI analysis columns to database...\n');

  const migrations = [
    {
      name: 'Add ai_analysis_data column to pets table',
      sql: `ALTER TABLE pets ADD COLUMN IF NOT EXISTS ai_analysis_data JSONB;`
    },
    {
      name: 'Add comment to pets.ai_analysis_data',
      sql: `COMMENT ON COLUMN pets.ai_analysis_data IS 'AI-detected characteristics from photo analysis using Claude vision (breed, coat, personality, physical traits)';`
    },
    {
      name: 'Create GIN index on pets.ai_analysis_data',
      sql: `CREATE INDEX IF NOT EXISTS idx_pets_ai_analysis ON pets USING GIN (ai_analysis_data);`
    },
    {
      name: 'Create index for breed detection queries',
      sql: `CREATE INDEX IF NOT EXISTS idx_pets_ai_breed ON pets ((ai_analysis_data->>'breed_detected'));`
    },
    {
      name: 'Create index for coat detection queries',
      sql: `CREATE INDEX IF NOT EXISTS idx_pets_ai_coat ON pets ((ai_analysis_data->>'coat_detected'));`
    },
    {
      name: 'Add ai_analysis column to pet_photos table',
      sql: `ALTER TABLE pet_photos ADD COLUMN IF NOT EXISTS ai_analysis JSONB;`
    },
    {
      name: 'Add comment to pet_photos.ai_analysis',
      sql: `COMMENT ON COLUMN pet_photos.ai_analysis IS 'AI analysis specific to this individual photo';`
    },
    {
      name: 'Create GIN index on pet_photos.ai_analysis',
      sql: `CREATE INDEX IF NOT EXISTS idx_pet_photos_ai_analysis ON pet_photos USING GIN (ai_analysis);`
    }
  ];

  let successCount = 0;
  let failCount = 0;

  for (const migration of migrations) {
    try {
      console.log(`⏳ ${migration.name}...`);

      const { error } = await supabase.rpc('exec_sql', { sql: migration.sql });

      if (error) {
        console.error(`   ❌ Failed: ${error.message}`);
        failCount++;

        // Show manual SQL for failed migrations
        console.log(`\n   💡 You may need to run this SQL manually in Supabase:`);
        console.log(`   ${migration.sql}\n`);
      } else {
        console.log(`   ✅ Success`);
        successCount++;
      }
    } catch (error) {
      console.error(`   ❌ Unexpected error:`, error);
      failCount++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Migration Summary:`);
  console.log(`  ✅ Successful: ${successCount}/${migrations.length}`);
  console.log(`  ❌ Failed: ${failCount}/${migrations.length}`);
  console.log(`${'='.repeat(60)}\n`);

  if (failCount === 0) {
    console.log('✅ All migrations completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Verify the schema with: npm run validate:schema');
    console.log('2. Test the new endpoint: POST /api/customers/pets/analyze-photo');
    console.log('3. Check the pets table structure in Supabase Dashboard\n');
  } else {
    console.log('⚠️  Some migrations failed. Please review errors above.');
    console.log('You may need to run the failed SQL statements manually in Supabase.\n');
    process.exit(1);
  }
}

// Run migration
console.log('🚀 Pet AI Analysis Database Migration');
console.log('=====================================\n');

addAIAnalysisColumn()
  .then(() => {
    console.log('✅ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  });
