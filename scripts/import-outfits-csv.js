#!/usr/bin/env node

/**
 * CSV Outfit Import Script
 * 
 * Imports outfits from CSV format: [outfit name],[description],[colour],[keywords]
 * Maps to database schema with proper field transformations
 * 
 * Usage: node scripts/import-outfits-csv.js path/to/outfits.csv
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Convert outfit name to URL-friendly slug
 */
function createSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')     // Replace spaces with hyphens
    .replace(/-+/g, '-')      // Replace multiple hyphens with single
    .replace(/^-|-$/g, '');   // Remove leading/trailing hyphens
}

/**
 * Parse comma-separated keywords into array
 */
function parseKeywords(keywordsString) {
  if (!keywordsString || keywordsString.trim() === '') {
    return [];
  }
  
  return keywordsString
    .split(',')
    .map(keyword => keyword.trim().toLowerCase())
    .filter(keyword => keyword.length > 0);
}

/**
 * Parse comma-separated colors into array
 */
function parseColors(colorString) {
  if (!colorString || colorString.trim() === '') {
    return [];
  }
  
  return colorString
    .split(',')
    .map(color => color.trim().toLowerCase())
    .filter(color => color.length > 0);
}

/**
 * Parse CSV line, handling quoted values and commas within quotes
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add the last field
  result.push(current.trim());
  
  return result;
}

/**
 * Transform CSV row to database record
 */
function transformOutfitRecord(csvRow, index) {
  const [name, description, colour, keywords] = csvRow;
  
  if (!name || name.trim() === '') {
    console.warn(`⚠️  Skipping row ${index + 1}: Missing outfit name`);
    return null;
  }
  
  const slug = createSlug(name);
  const colorScheme = parseColors(colour);
  const styleKeywords = parseKeywords(keywords);
  
  // Use description as clothing_description for the AI prompt
  const clothingDescription = description && description.trim() 
    ? `wearing ${description.trim().toLowerCase()}`
    : `wearing ${name.toLowerCase()}`;
  
  return {
    name: name.trim(),
    slug: slug,
    description: description?.trim() || '',
    clothing_description: clothingDescription,
    color_scheme: colorScheme,
    style_keywords: styleKeywords,
    seasonal_relevance: {}, // Empty JSON object, can be updated later
    animal_compatibility: ['dog', 'cat'], // Default to both
    is_active: true,
    sort_order: index + 1000 // Start at 1000 to avoid conflicts with existing data
  };
}

/**
 * Main import function
 */
async function importOutfits(csvFilePath) {
  try {
    console.log(`🔍 Reading CSV file: ${csvFilePath}`);
    
    if (!fs.existsSync(csvFilePath)) {
      throw new Error(`File not found: ${csvFilePath}`);
    }
    
    const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim() !== '');
    
    console.log(`📄 Found ${lines.length} lines in CSV`);
    
    const outfits = [];
    const errors = [];
    
    for (let i = 0; i < lines.length; i++) {
      try {
        const csvRow = parseCSVLine(lines[i]);
        
        if (csvRow.length < 2) {
          console.warn(`⚠️  Skipping row ${i + 1}: Insufficient columns (${csvRow.length})`);
          continue;
        }
        
        const outfit = transformOutfitRecord(csvRow, i);
        if (outfit) {
          outfits.push(outfit);
          console.log(`✅ Parsed: "${outfit.name}" -> "${outfit.slug}"`);
        }
      } catch (error) {
        const errorMsg = `Row ${i + 1}: ${error.message}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }
    
    if (outfits.length === 0) {
      console.error('❌ No valid outfits to import');
      return;
    }
    
    console.log(`\n🚀 Importing ${outfits.length} outfits to database...`);
    
    // Check for existing slugs to avoid duplicates
    const existingSlugs = new Set();
    const { data: existing } = await supabase
      .from('outfits')
      .select('slug');
    
    if (existing) {
      existing.forEach(item => existingSlugs.add(item.slug));
    }
    
    // Filter out duplicates
    const newOutfits = outfits.filter(outfit => {
      if (existingSlugs.has(outfit.slug)) {
        console.warn(`⚠️  Skipping duplicate: "${outfit.name}" (slug: ${outfit.slug})`);
        return false;
      }
      return true;
    });
    
    if (newOutfits.length === 0) {
      console.log('ℹ️  All outfits already exist in database');
      return;
    }
    
    // Insert in batches of 100
    const batchSize = 100;
    let imported = 0;
    
    for (let i = 0; i < newOutfits.length; i += batchSize) {
      const batch = newOutfits.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('outfits')
        .insert(batch)
        .select('id, name, slug');
      
      if (error) {
        console.error(`❌ Batch insert error:`, error);
        continue;
      }
      
      if (data) {
        imported += data.length;
        console.log(`✅ Imported batch ${Math.floor(i / batchSize) + 1}: ${data.length} outfits`);
      }
    }
    
    console.log(`\n🎉 Import completed!`);
    console.log(`   • Successfully imported: ${imported} outfits`);
    console.log(`   • Skipped (duplicates): ${outfits.length - newOutfits.length}`);
    console.log(`   • Parsing errors: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log(`\n❌ Errors encountered:`);
      errors.forEach(error => console.log(`   • ${error}`));
    }
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    process.exit(1);
  }
}

// Command line usage
if (require.main === module) {
  const csvFilePath = process.argv[2];
  
  if (!csvFilePath) {
    console.error('❌ Usage: node scripts/import-outfits-csv.js <path-to-csv-file>');
    console.error('\nExample: node scripts/import-outfits-csv.js data/outfits.csv');
    console.error('\nCSV Format: [outfit name],[description],[colour],[keywords]');
    console.error('Example CSV line: "Summer Dress","a light blue summer dress","blue,white","casual,summer,dress"');
    process.exit(1);
  }
  
  importOutfits(csvFilePath);
}

module.exports = { importOutfits };