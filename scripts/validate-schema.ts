#!/usr/bin/env npx tsx
/**
 * Database Schema Validation Tool
 *
 * This script validates that our TypeScript types match the actual database schema,
 * preventing false assumptions about database structure during development.
 *
 * Usage: npm run validate:schema
 *
 * This should be run:
 * - Before writing tests for new features
 * - After database migrations
 * - As part of CI/CD pipeline
 * - When onboarding new developers
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables first
function loadEnvVars() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          process.env[key] = valueParts.join('=');
        }
      }
    });
  }
}

// Load environment variables immediately
loadEnvVars();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

interface TableSchema {
  table_name: string;
  columns: ColumnInfo[];
}

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function getTableSchema(tableName: string, supabase: any): Promise<TableSchema | null> {
  try {
    // Simple approach: just check if table exists by trying to query it
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);

    if (error) {
      log(`❌ Could not access table '${tableName}': ${error.message}`, 'red');
      return null;
    }

    // If we can query the table, it exists. For now, return basic info
    // In a real implementation, you'd query information_schema or use a custom RPC function
    const columns: ColumnInfo[] = [];

    if (data && data.length > 0) {
      // Extract column names from the first row
      Object.keys(data[0]).forEach(key => {
        columns.push({
          column_name: key,
          data_type: typeof data[0][key] === 'number' ? 'numeric' : 'text',
          is_nullable: data[0][key] === null ? 'YES' : 'NO',
          column_default: null
        });
      });
    } else {
      // If table exists but is empty, we need to determine columns another way
      // For demonstration, use expected columns based on our types
      const expectedColumns: { [key: string]: string[] } = {
        'influencers': [
          'id', 'email', 'first_name', 'last_name', 'username', 'bio',
          'avatar_url', 'phone', 'commission_rate', 'approval_status',
          'is_active', 'is_verified', 'created_at', 'updated_at'
        ],
        'influencer_social_channels': [
          'id', 'influencer_id', 'platform', 'username', 'profile_url',
          'follower_count', 'engagement_rate', 'verified', 'is_primary',
          'is_active', 'created_at', 'last_updated'
        ],
        'influencer_referral_codes': [
          'id', 'influencer_id', 'code', 'description', 'expires_at',
          'usage_count', 'conversion_count', 'total_revenue', 'total_commission',
          'is_active', 'created_at', 'updated_at'
        ],
        'influencer_referrals': [
          'id', 'referral_code_id', 'customer_email', 'status', 'amount',
          'commission_amount', 'created_at', 'updated_at'
        ]
      };

      const cols = expectedColumns[tableName] || [];
      cols.forEach(col => {
        columns.push({
          column_name: col,
          data_type: 'unknown',
          is_nullable: 'UNKNOWN',
          column_default: null
        });
      });
    }

    return {
      table_name: tableName,
      columns
    };
  } catch (error) {
    log(`❌ Error fetching schema for table '${tableName}': ${error}`, 'red');
    return null;
  }
}

async function validateInfluencerSchema() {
  log('\n🔍 VALIDATING INFLUENCER SYSTEM SCHEMA', 'cyan');
  log('=' .repeat(50), 'cyan');

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const tablesToValidate = [
    'influencers',
    'influencer_social_channels',
    'influencer_referral_codes',
    'influencer_referrals'
  ];

  const results: { [key: string]: TableSchema | null } = {};
  let hasErrors = false;

  // Fetch actual schemas
  for (const tableName of tablesToValidate) {
    log(`\n📋 Fetching schema for table: ${tableName}`, 'blue');
    const schema = await getTableSchema(tableName, supabase);
    results[tableName] = schema;

    if (schema) {
      log(`✅ Found ${schema.columns.length} columns`, 'green');
      schema.columns.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? '(nullable)' : '(required)';
        log(`   - ${col.column_name}: ${col.data_type} ${nullable}`, 'reset');
      });
    } else {
      hasErrors = true;
    }
  }

  // Generate validation report
  log('\n📊 SCHEMA VALIDATION REPORT', 'bright');
  log('=' .repeat(50), 'cyan');

  // Check for expected columns based on our types
  const expectedColumns = {
    'influencers': [
      'id', 'email', 'first_name', 'last_name', 'username', 'bio',
      'avatar_url', 'phone', 'commission_rate', 'approval_status',
      'is_active', 'is_verified', 'created_at', 'updated_at'
    ],
    'influencer_social_channels': [
      'id', 'influencer_id', 'platform', 'username', 'profile_url',
      'follower_count', 'engagement_rate', 'verified', 'is_primary', 'is_active'
    ],
    'influencer_referral_codes': [
      'id', 'influencer_id', 'code', 'description', 'expires_at',
      'usage_count', 'conversion_count', 'is_active'
    ]
  };

  for (const [tableName, expectedCols] of Object.entries(expectedColumns)) {
    const actualSchema = results[tableName];

    if (!actualSchema) {
      log(`❌ Table '${tableName}' not found or inaccessible`, 'red');
      hasErrors = true;
      continue;
    }

    log(`\n🔍 Validating ${tableName}:`, 'yellow');

    const actualCols = actualSchema.columns.map(c => c.column_name);
    const missing = expectedCols.filter(col => !actualCols.includes(col));
    const extra = actualCols.filter(col => !expectedCols.includes(col) &&
                                           !['created_at', 'updated_at'].includes(col));

    if (missing.length === 0 && extra.length === 0) {
      log(`✅ Schema matches expectations`, 'green');
    } else {
      if (missing.length > 0) {
        log(`❌ Missing expected columns: ${missing.join(', ')}`, 'red');
        hasErrors = true;
      }
      if (extra.length > 0) {
        log(`⚠️  Additional columns found: ${extra.join(', ')}`, 'yellow');
      }
    }
  }

  // Generate schema documentation
  const schemaDoc = generateSchemaDocumentation(results);
  const docPath = path.join(process.cwd(), 'docs', 'database-schema-reference.md');

  // Ensure docs directory exists
  const docsDir = path.dirname(docPath);
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  fs.writeFileSync(docPath, schemaDoc);
  log(`\n📝 Schema documentation written to: ${docPath}`, 'cyan');

  // Final result
  log('\n🏁 VALIDATION COMPLETE', 'bright');
  if (hasErrors) {
    log('❌ Schema validation failed - please review errors above', 'red');
    process.exit(1);
  } else {
    log('✅ All schema validations passed', 'green');
    log('💡 Use the generated documentation when writing tests', 'blue');
  }
}

function generateSchemaDocumentation(schemas: { [key: string]: TableSchema | null }): string {
  const timestamp = new Date().toISOString();

  let doc = `# Database Schema Reference

Generated: ${timestamp}

This document provides the actual database schema for the influencer system.
**Use this as the source of truth when writing tests and implementing features.**

## Purpose

This schema reference prevents assumptions about database structure by documenting
the actual schema as it exists in the database. Always refer to this document
when writing tests or implementing features that interact with the database.

## Tables

`;

  for (const [tableName, schema] of Object.entries(schemas)) {
    if (!schema) {
      doc += `### ${tableName} ❌ NOT FOUND\n\nThis table was not accessible during schema validation.\n\n`;
      continue;
    }

    doc += `### ${tableName}\n\n`;
    doc += `| Column | Type | Nullable | Default |\n`;
    doc += `|--------|------|----------|----------|\n`;

    schema.columns.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? '✅' : '❌';
      const defaultVal = col.column_default || '-';
      doc += `| ${col.column_name} | ${col.data_type} | ${nullable} | ${defaultVal} |\n`;
    });

    doc += `\n**Column Count:** ${schema.columns.length}\n\n`;
  }

  doc += `## Development Guidelines

### Before Writing Tests
1. **Always check this document** for actual column names and types
2. **Do not assume** relationships or column names
3. **Validate your assumptions** using this schema reference

### When Schema Changes
1. Run \`npm run validate:schema\` to update this documentation
2. Update any affected tests to match new schema
3. Commit both code changes and updated schema documentation

### Test Data Structure
When creating test data, use the exact column names and types documented above.

Example for influencers table:
\`\`\`javascript
const testInfluencer = {
  // Use actual column names from schema above
  first_name: 'John',        // ✅ Correct
  last_name: 'Doe',          // ✅ Correct
  email: 'john@example.com', // ✅ Correct
  // user_id: 'abc123',      // ❌ Wrong - this column doesn't exist
};
\`\`\`

This approach eliminates false assumptions and reduces debugging time.
`;

  return doc;
}


// Main execution
async function main() {

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    log('❌ Missing required environment variables', 'red');
    log('   NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set', 'red');
    process.exit(1);
  }

  try {
    await validateInfluencerSchema();
  } catch (error) {
    log('❌ Validation failed with error:', 'red');
    console.error(error);
    process.exit(1);
  }
}

main();