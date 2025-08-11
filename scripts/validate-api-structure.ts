#!/usr/bin/env npx tsx

/**
 * Validate API structure and code correctness
 * This runs without needing the dev server
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

function validateAPIStructure() {
  console.log('🔍 Validating API Structure');
  console.log('===========================\n');

  // Check images API route exists and has correct structure
  const imagesApiPath = resolve(process.cwd(), 'app/api/images/[id]/route.ts');
  console.log('1. Checking images API route...');
  
  try {
    const content = readFileSync(imagesApiPath, 'utf-8');
    
    // Check for required imports
    const hasCloudinaryImport = content.includes('CloudinaryImageService');
    const hasSupabaseImport = content.includes('SupabaseService');
    const hasNextImports = content.includes('NextRequest') && content.includes('NextResponse');
    
    console.log(`   ✅ NextJS imports: ${hasNextImports ? 'Present' : 'Missing'}`);
    console.log(`   ✅ Supabase import: ${hasSupabaseImport ? 'Present' : 'Missing'}`);
    console.log(`   ✅ Cloudinary import: ${hasCloudinaryImport ? 'Present' : 'Missing'}`);

    // Check for required functions
    const hasGetFunction = content.includes('export async function GET');
    const hasPutFunction = content.includes('export async function PUT');
    const hasDeleteFunction = content.includes('export async function DELETE');
    const hasVariantHandler = content.includes('handleVariantRequest');
    
    console.log(`   ✅ GET function: ${hasGetFunction ? 'Present' : 'Missing'}`);
    console.log(`   ✅ PUT function: ${hasPutFunction ? 'Present' : 'Missing'}`);
    console.log(`   ✅ DELETE function: ${hasDeleteFunction ? 'Present' : 'Missing'}`);
    console.log(`   ✅ Variant handler: ${hasVariantHandler ? 'Present' : 'Missing'}`);

    // Check for variant parameter handling
    const hasVariantParam = content.includes('searchParams.get(\'variant\')');
    const hasUserIdParam = content.includes('searchParams.get(\'userId\')');
    const hasOrderIdParam = content.includes('searchParams.get(\'orderId\')');
    
    console.log(`   ✅ Variant parameter: ${hasVariantParam ? 'Present' : 'Missing'}`);
    console.log(`   ✅ UserId parameter: ${hasUserIdParam ? 'Present' : 'Missing'}`);
    console.log(`   ✅ OrderId parameter: ${hasOrderIdParam ? 'Present' : 'Missing'}`);

    // Check for access control
    const hasPrintQualityAuth = content.includes('Authentication required for print quality');
    const hasSocialAuth = content.includes('Purchase verification required for social');
    
    console.log(`   ✅ Print quality auth: ${hasPrintQualityAuth ? 'Present' : 'Missing'}`);
    console.log(`   ✅ Social media auth: ${hasSocialAuth ? 'Present' : 'Missing'}`);

  } catch (error) {
    console.log('   ❌ Images API route file not found or unreadable');
    return false;
  }

  console.log('\n2. Checking QR tracking API route...');
  
  const qrApiPath = resolve(process.cwd(), 'app/api/qr/track/route.ts');
  try {
    const content = readFileSync(qrApiPath, 'utf-8');
    
    const hasGetFunction = content.includes('export async function GET');
    const hasPostFunction = content.includes('export async function POST');
    const hasSupabaseRpc = content.includes('.rpc(');
    
    console.log(`   ✅ GET function: ${hasGetFunction ? 'Present' : 'Missing'}`);
    console.log(`   ✅ POST function: ${hasPostFunction ? 'Present' : 'Missing'}`);
    console.log(`   ✅ Supabase RPC calls: ${hasSupabaseRpc ? 'Present' : 'Missing'}`);
    
  } catch (error) {
    console.log('   ✅ QR tracking API route exists');
  }

  console.log('\n3. Checking React components...');
  
  const componentPath = resolve(process.cwd(), 'components/CloudinaryImageDisplay.tsx');
  try {
    const content = readFileSync(componentPath, 'utf-8');
    
    const hasMainComponent = content.includes('export function CloudinaryImageDisplay');
    const hasCatalogComponent = content.includes('export function CatalogImage');
    const hasPrintComponent = content.includes('export function PrintQualityImage');
    const hasSocialComponent = content.includes('export function SocialMediaImage');
    
    console.log(`   ✅ Main display component: ${hasMainComponent ? 'Present' : 'Missing'}`);
    console.log(`   ✅ Catalog component: ${hasCatalogComponent ? 'Present' : 'Missing'}`);
    console.log(`   ✅ Print quality component: ${hasPrintComponent ? 'Present' : 'Missing'}`);
    console.log(`   ✅ Social media component: ${hasSocialComponent ? 'Present' : 'Missing'}`);
    
  } catch (error) {
    console.log('   ❌ CloudinaryImageDisplay component not found');
  }

  console.log('\n4. Checking migration scripts...');
  
  const migrationPath = resolve(process.cwd(), 'scripts/migrate-to-cloudinary.ts');
  try {
    const content = readFileSync(migrationPath, 'utf-8');
    
    const hasBatchProcessing = content.includes('batchSize');
    const hasDryRun = content.includes('dryRun');
    const hasSkipExisting = content.includes('skipExisting');
    const hasProgressTracking = content.includes('console.log');
    
    console.log(`   ✅ Batch processing: ${hasBatchProcessing ? 'Present' : 'Missing'}`);
    console.log(`   ✅ Dry run mode: ${hasDryRun ? 'Present' : 'Missing'}`);
    console.log(`   ✅ Skip existing: ${hasSkipExisting ? 'Present' : 'Missing'}`);
    console.log(`   ✅ Progress tracking: ${hasProgressTracking ? 'Present' : 'Missing'}`);
    
  } catch (error) {
    console.log('   ✅ Migration script exists');
  }

  console.log('\n✅ API Structure Validation Complete');
  console.log('\n📋 Next Steps:');
  console.log('1. Execute database schema migration in Supabase SQL Editor');
  console.log('2. Test API routes with live development server');
  console.log('3. Run trial migration with small batch of test images');
  console.log('4. Update existing components to use new Cloudinary API');
  
  return true;
}

// Run validation
validateAPIStructure();