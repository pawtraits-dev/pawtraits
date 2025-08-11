#!/usr/bin/env npx tsx

// Load environment variables first
import * as dotenv from 'dotenv';
const result = dotenv.config({ path: '.env.local' });

console.log('🔍 Environment Variable Debug');
console.log('============================\n');

console.log('1. Dotenv loading result:', result.error ? `❌ Error: ${result.error}` : '✅ Success');

console.log('\n2. Environment variables:');
console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME ? '✅ Found' : '❌ Missing', process.env.CLOUDINARY_CLOUD_NAME);
console.log('CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? '✅ Found' : '❌ Missing', process.env.CLOUDINARY_API_KEY);
console.log('CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? '✅ Found (hidden)' : '❌ Missing');
console.log('CLOUDINARY_URL:', process.env.CLOUDINARY_URL ? '✅ Found' : '❌ Missing');

console.log('\n3. Working directory:', process.cwd());

import * as fs from 'fs';
const envPath = '.env.local';
console.log('4. .env.local exists:', fs.existsSync(envPath) ? '✅ Yes' : '❌ No');

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  console.log('\n5. .env.local content (first few lines):');
  lines.slice(0, 10).forEach((line, i) => {
    if (line.includes('CLOUDINARY')) {
      console.log(`   Line ${i+1}: ${line.substring(0, 50)}...`);
    }
  });
}