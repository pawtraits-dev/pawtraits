/**
 * Debug API: Investigate image URL patterns
 *
 * Purpose: Understand what URL formats exist in the database
 * and why the fix script might not be finding all affected images
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
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

    // Get total image counts
    const { count: totalCount } = await supabase
      .from('image_catalog')
      .select('*', { count: 'exact', head: true });

    const { count: withCloudinaryId } = await supabase
      .from('image_catalog')
      .select('*', { count: 'exact', head: true })
      .not('cloudinary_public_id', 'is', null)
      .neq('cloudinary_public_id', '');

    const { count: missingCloudinaryId } = await supabase
      .from('image_catalog')
      .select('*', { count: 'exact', head: true })
      .or('cloudinary_public_id.is.null,cloudinary_public_id.eq.');

    console.log('📊 Image counts:', {
      total: totalCount,
      withCloudinaryId,
      missingCloudinaryId
    });

    // Get sample images missing cloudinary_public_id
    const { data: sampleImages } = await supabase
      .from('image_catalog')
      .select('id, cloudinary_public_id, public_url, image_variants, created_at')
      .or('cloudinary_public_id.is.null,cloudinary_public_id.eq.')
      .order('created_at', { ascending: false })
      .limit(10);

    console.log('\n📋 Sample images missing cloudinary_public_id:');
    const urlPatterns: any[] = [];

    for (const img of sampleImages || []) {
      const variants = img.image_variants as any;
      const originalUrl = variants?.original?.url || '';
      const publicUrl = img.public_url || '';

      console.log(`\nImage ${img.id}:`);
      console.log(`  Created: ${img.created_at}`);
      console.log(`  Has public_url: ${!!publicUrl}`);
      console.log(`  Has image_variants: ${!!img.image_variants}`);
      console.log(`  Has original variant: ${!!originalUrl}`);

      if (publicUrl) {
        console.log(`  public_url: ${publicUrl.substring(0, 150)}`);
      }
      if (originalUrl) {
        console.log(`  original_url: ${originalUrl.substring(0, 150)}`);
      }

      urlPatterns.push({
        id: img.id,
        created_at: img.created_at,
        has_public_url: !!publicUrl,
        has_original_url: !!originalUrl,
        public_url_preview: publicUrl ? publicUrl.substring(0, 100) : null,
        original_url_preview: originalUrl ? originalUrl.substring(0, 100) : null,
        is_cloudinary_public: publicUrl?.includes('cloudinary.com') || false,
        is_cloudinary_original: originalUrl?.includes('cloudinary.com') || false,
        is_supabase_public: publicUrl?.includes('supabase') || false,
        is_supabase_original: originalUrl?.includes('supabase') || false
      });
    }

    // Also check some images that DO have cloudinary_public_id
    const { data: withIdSample } = await supabase
      .from('image_catalog')
      .select('id, cloudinary_public_id, public_url, created_at')
      .not('cloudinary_public_id', 'is', null)
      .neq('cloudinary_public_id', '')
      .order('created_at', { ascending: false })
      .limit(5);

    console.log('\n✅ Sample images WITH cloudinary_public_id:');
    const goodExamples: any[] = [];

    for (const img of withIdSample || []) {
      console.log(`\nImage ${img.id}:`);
      console.log(`  Created: ${img.created_at}`);
      console.log(`  cloudinary_public_id: ${img.cloudinary_public_id}`);
      console.log(`  public_url: ${img.public_url?.substring(0, 150)}`);

      goodExamples.push({
        id: img.id,
        created_at: img.created_at,
        cloudinary_public_id: img.cloudinary_public_id,
        public_url_preview: img.public_url?.substring(0, 100)
      });
    }

    return NextResponse.json({
      success: true,
      summary: {
        total_images: totalCount,
        with_cloudinary_id: withCloudinaryId,
        missing_cloudinary_id: missingCloudinaryId,
        percentage_missing: totalCount ? ((missingCloudinaryId || 0) / totalCount * 100).toFixed(1) : 0
      },
      sample_missing: urlPatterns,
      sample_with_id: goodExamples
    }, { status: 200 });

  } catch (error) {
    console.error('❌ Debug failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
