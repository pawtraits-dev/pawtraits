/**
 * Diagnostic Script: Gelato URL Issue Investigation
 *
 * Purpose: Identify why some images get ?_a= parameter in Gelato orders
 *
 * Hypothesis: Images missing cloudinary_public_id fall back to stored URLs
 * which contain old signed URLs with authentication parameters
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// For ES modules compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables - try multiple locations
const possibleEnvPaths = [
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), '.env.staging'),
  path.resolve(process.cwd(), '.env.production'),
  path.resolve(process.cwd(), '.env')
];

let envLoaded = false;
for (const envPath of possibleEnvPaths) {
  const result = dotenv.config({ path: envPath });
  if (!result.error) {
    console.log(`✅ Loaded env from: ${envPath}`);
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  console.error('❌ No .env file found');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function diagnoseGelatoUrls() {
  console.log('🔍 GELATO URL DIAGNOSTIC TOOL\n');
  console.log('Purpose: Identify images with problematic URLs for print fulfillment\n');

  // Get recent orders with multiple items
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id, created_at, order_data')
    .order('created_at', { ascending: false })
    .limit(10);

  if (ordersError || !orders) {
    console.error('❌ Failed to fetch orders:', ordersError);
    return;
  }

  console.log(`📦 Analyzing ${orders.length} recent orders...\n`);

  for (const order of orders) {
    const orderData = order.order_data as any;
    const items = orderData?.items || [];

    if (items.length === 0) continue;

    console.log(`\n📦 Order ${order.id} (${items.length} items):`);
    console.log(`   Created: ${order.created_at}`);

    for (const item of items) {
      const imageId = item.image_id;
      if (!imageId) continue;

      // Get image details from database
      const { data: imageData, error: imageError } = await supabase
        .from('image_catalog')
        .select('id, cloudinary_public_id, public_url, image_variants')
        .eq('id', imageId)
        .single();

      if (imageError || !imageData) {
        console.log(`   ❌ Image ${imageId}: Not found in catalog`);
        continue;
      }

      // Check what URL would be used
      const hasCloudinaryId = !!imageData.cloudinary_public_id;
      const hasStoredVariants = !!(imageData.image_variants as any)?.original?.url;
      const storedUrl = (imageData.image_variants as any)?.original?.url || '';
      const hasAuthParam = storedUrl.includes('?_a=') || storedUrl.includes('auth_token');

      let urlSource = '';
      let urlPreview = '';
      let hasIssue = false;

      if (hasCloudinaryId) {
        urlSource = '✅ Fresh URL (getGelatoPrintUrl)';
        urlPreview = `https://res.cloudinary.com/.../c_fit.../v1/${imageData.cloudinary_public_id}.png`;
      } else if (hasStoredVariants) {
        urlSource = '⚠️  Stored URL (fallback)';
        urlPreview = storedUrl.substring(0, 80) + '...';
        hasIssue = hasAuthParam;
      } else {
        urlSource = '❌ No URL available';
        hasIssue = true;
      }

      console.log(`\n   🖼️  Image ${imageId}:`);
      console.log(`      Cloudinary ID: ${hasCloudinaryId ? '✅ Present' : '❌ Missing'}`);
      console.log(`      URL Source: ${urlSource}`);
      if (hasIssue) {
        console.log(`      ⚠️  ISSUE: ${hasAuthParam ? 'Has ?_a= authentication parameter' : 'No valid URL'}`);
      }
      console.log(`      Preview: ${urlPreview}`);
    }
  }

  // Summary: Count images by URL source
  console.log('\n\n📊 SUMMARY ANALYSIS:\n');

  const { data: allImages, error: summaryError } = await supabase
    .from('image_catalog')
    .select('id, cloudinary_public_id, image_variants')
    .order('created_at', { ascending: false })
    .limit(100);

  if (!summaryError && allImages) {
    let hasCloudinaryId = 0;
    let missingCloudinaryId = 0;
    let hasAuthParamInStored = 0;

    for (const img of allImages) {
      if (img.cloudinary_public_id) {
        hasCloudinaryId++;
      } else {
        missingCloudinaryId++;
        const storedUrl = (img.image_variants as any)?.original?.url || '';
        if (storedUrl.includes('?_a=') || storedUrl.includes('auth_token')) {
          hasAuthParamInStored++;
        }
      }
    }

    console.log(`Total images analyzed: ${allImages.length}`);
    console.log(`✅ With cloudinary_public_id: ${hasCloudinaryId} (will generate fresh URLs)`);
    console.log(`❌ Missing cloudinary_public_id: ${missingCloudinaryId} (will use stored URLs)`);
    console.log(`⚠️  Stored URLs with auth params: ${hasAuthParamInStored} (WILL FAIL with Gelato)`);
  }

  console.log('\n\n💡 DIAGNOSIS:');
  console.log('   The webhook code has this fallback logic:');
  console.log('   1. IF cloudinary_public_id exists → Generate fresh URL ✅');
  console.log('   2. ELSE IF image_variants.original.url exists → Use stored URL ⚠️');
  console.log('   3. ELSE use public_url ❌');
  console.log('\n   Images without cloudinary_public_id use old stored URLs');
  console.log('   which may contain authentication parameters that Gelato cannot access.');
}

diagnoseGelatoUrls().catch(console.error);
