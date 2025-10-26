/**
 * Fix API: Populate missing cloudinary_public_id fields
 *
 * Purpose: Fix images that are missing cloudinary_public_id by extracting it
 * from their stored URLs (public_url or image_variants.original.url)
 *
 * This enables the webhook to generate fresh URLs instead of using old stored URLs
 * with authentication parameters that Gelato cannot access.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface FixResult {
  imageId: string;
  oldCloudinaryId: string | null;
  newCloudinaryId: string;
  extractedFrom: 'public_url' | 'image_variants' | 'failed';
  success: boolean;
  error?: string;
  sample_url?: string;
}

/**
 * Extract Cloudinary public_id from a URL
 * Example: https://res.cloudinary.com/dnhzfz8xv/image/upload/v1761480789065/pawtraits/customer-variations/batch-123.png?_a=...
 * Extract: pawtraits/customer-variations/batch-123
 */
function extractPublicIdFromUrl(url: string): string | null {
  if (!url) return null;

  try {
    // Match Cloudinary URL pattern
    // Format: https://res.cloudinary.com/{cloud}/image/upload/{transformations}/{version}/{public_id}.{format}
    const regex = /cloudinary\.com\/[^\/]+\/image\/upload\/(?:v\d+\/)?([^?]+?)(?:\.\w+)?(?:\?|$)/;
    const match = url.match(regex);

    if (match && match[1]) {
      // Remove file extension if present
      let publicId = match[1];
      const lastDot = publicId.lastIndexOf('.');
      if (lastDot > publicId.lastIndexOf('/')) {
        // Only remove extension if it comes after the last folder separator
        publicId = publicId.substring(0, lastDot);
      }
      return publicId;
    }

    return null;
  } catch (error) {
    console.error('Error extracting public_id from URL:', error);
    return null;
  }
}

export async function POST() {
  try {
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

    console.log('🔍 Finding images with missing cloudinary_public_id...');

    // Get total counts first for context
    const { count: totalCount } = await supabase
      .from('image_catalog')
      .select('*', { count: 'exact', head: true });

    const { count: missingCount } = await supabase
      .from('image_catalog')
      .select('*', { count: 'exact', head: true })
      .or('cloudinary_public_id.is.null,cloudinary_public_id.eq.');

    console.log(`📊 Database stats: ${missingCount} of ${totalCount} images missing cloudinary_public_id (${totalCount ? ((missingCount || 0) / totalCount * 100).toFixed(1) : 0}%)`);

    // Find images missing cloudinary_public_id
    const { data: images, error: fetchError } = await supabase
      .from('image_catalog')
      .select('id, cloudinary_public_id, public_url, image_variants, created_at')
      .or('cloudinary_public_id.is.null,cloudinary_public_id.eq.')
      .order('created_at', { ascending: false })
      .limit(100);

    if (fetchError) {
      throw new Error(`Failed to fetch images: ${fetchError.message}`);
    }

    if (!images || images.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No images found with missing cloudinary_public_id',
        results: []
      });
    }

    console.log(`📋 Found ${images.length} images to fix`);

    const results: FixResult[] = [];

    for (const img of images) {
      console.log(`\n🔧 Processing image: ${img.id} (created: ${img.created_at})`);

      const variants = img.image_variants as any;
      const originalUrl = variants?.original?.url || '';
      const publicUrl = img.public_url || '';

      console.log(`  📋 Available URLs:`);
      console.log(`     public_url: ${publicUrl ? publicUrl.substring(0, 100) + '...' : 'NONE'}`);
      console.log(`     original_url: ${originalUrl ? originalUrl.substring(0, 100) + '...' : 'NONE'}`);

      let extractedId: string | null = null;
      let extractedFrom: 'public_url' | 'image_variants' | 'failed' = 'failed';

      // Try extracting from public_url first
      if (publicUrl) {
        extractedId = extractPublicIdFromUrl(publicUrl);
        if (extractedId) {
          extractedFrom = 'public_url';
          console.log(`  ✅ Extracted from public_url: ${extractedId}`);
        } else {
          console.log(`  ❌ Failed to extract from public_url (not Cloudinary format?)`);
        }
      }

      // If not found, try image_variants.original.url
      if (!extractedId && originalUrl) {
        extractedId = extractPublicIdFromUrl(originalUrl);
        if (extractedId) {
          extractedFrom = 'image_variants';
          console.log(`  ✅ Extracted from image_variants: ${extractedId}`);
        } else {
          console.log(`  ❌ Failed to extract from image_variants (not Cloudinary format?)`);
        }
      }

      // Update database if we found a public_id
      if (extractedId) {
        const { error: updateError } = await supabase
          .from('image_catalog')
          .update({ cloudinary_public_id: extractedId })
          .eq('id', img.id);

        if (updateError) {
          console.error(`  ❌ Failed to update: ${updateError.message}`);
          results.push({
            imageId: img.id,
            oldCloudinaryId: img.cloudinary_public_id,
            newCloudinaryId: extractedId,
            extractedFrom,
            success: false,
            error: updateError.message
          });
        } else {
          console.log(`  ✅ Updated successfully`);
          results.push({
            imageId: img.id,
            oldCloudinaryId: img.cloudinary_public_id,
            newCloudinaryId: extractedId,
            extractedFrom,
            success: true
          });
        }
      } else {
        console.error(`  ❌ Could not extract public_id from any URL`);
        console.error(`     This image may use Supabase Storage URLs or other non-Cloudinary URLs`);
        console.error(`     Webhook will handle these with recovery logic if auth params detected`);
        results.push({
          imageId: img.id,
          oldCloudinaryId: img.cloudinary_public_id,
          newCloudinaryId: '',
          extractedFrom: 'failed',
          success: false,
          error: 'No valid Cloudinary URL found - may be Supabase Storage or legacy format',
          sample_url: publicUrl || originalUrl || 'no urls available'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`\n📊 Summary:`);
    console.log(`  ✅ Successfully fixed: ${successCount}`);
    console.log(`  ❌ Failed: ${failCount}`);

    return NextResponse.json({
      success: true,
      message: `Fixed ${successCount} of ${images.length} images`,
      database_stats: {
        total_images: totalCount,
        missing_cloudinary_id: missingCount,
        percentage_missing: totalCount ? ((missingCount || 0) / totalCount * 100).toFixed(1) + '%' : '0%'
      },
      summary: {
        total: images.length,
        succeeded: successCount,
        failed: failCount
      },
      results
    }, { status: 200 });

  } catch (error) {
    console.error('❌ Fix operation failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
