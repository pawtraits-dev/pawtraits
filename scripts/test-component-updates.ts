#!/usr/bin/env npx tsx

/**
 * Test that component updates are working properly
 */

import { readFileSync } from 'fs';

function testComponentUpdates() {
  console.log('🧪 Testing Component Updates');
  console.log('============================\n');

  const componentsToTest = [
    '/Users/steveswain/Documents/pawtraits/dev/pawtraits-prompt-system/app/customer/shop/page.tsx',
    '/Users/steveswain/Documents/pawtraits/dev/pawtraits-prompt-system/app/customer/gallery/page.tsx', 
    '/Users/steveswain/Documents/pawtraits/dev/pawtraits-prompt-system/app/admin/catalog/page.tsx',
    '/Users/steveswain/Documents/pawtraits/dev/pawtraits-prompt-system/components/share-modal.tsx'
  ];

  let passed = 0;
  let total = componentsToTest.length;

  for (const filePath of componentsToTest) {
    const fileName = filePath.split('/').pop();
    console.log(`📄 Testing ${fileName}...`);

    try {
      const content = readFileSync(filePath, 'utf-8');
      
      // Check for Cloudinary imports
      const hasCloudinaryImport = content.includes('CloudinaryImageDisplay') || content.includes('CatalogImage');
      
      // Check for updated image components
      const hasCatalogImageUsage = content.includes('<CatalogImage');
      
      // Check that old public_url image tags are replaced
      const hasOldImgTags = content.includes('src={image.public_url}') || content.includes('src={image?.public_url}');
      
      console.log(`   ✅ Cloudinary import: ${hasCloudinaryImport ? 'Present' : 'Missing'}`);
      console.log(`   ✅ CatalogImage usage: ${hasCatalogImageUsage ? 'Present' : 'Missing'}`);
      console.log(`   ✅ Old img tags removed: ${!hasOldImgTags ? 'Yes' : 'Still present'}`);
      
      if (hasCloudinaryImport && hasCatalogImageUsage && !hasOldImgTags) {
        console.log(`   🎉 ${fileName} successfully updated!\n`);
        passed++;
      } else {
        console.log(`   ⚠️  ${fileName} needs more updates\n`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error reading ${fileName}: ${error}\n`);
    }
  }

  console.log(`📊 Component Update Results:`);
  console.log(`   Updated: ${passed}/${total} components`);
  console.log(`   Success rate: ${Math.round((passed/total) * 100)}%`);

  if (passed === total) {
    console.log(`\n🎉 All components successfully updated to use Cloudinary!`);
    console.log(`\n📋 Next steps:`);
    console.log(`   1. Test the updated components in browser`);
    console.log(`   2. Migrate more images if needed`);
    console.log(`   3. Build QR landing pages for partners`);
  } else {
    console.log(`\n⚠️  Some components still need updates`);
  }
}

// Run the test
testComponentUpdates();