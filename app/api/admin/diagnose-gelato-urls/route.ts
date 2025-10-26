/**
 * Diagnostic API: Gelato URL Issue Investigation
 *
 * Purpose: Identify why some images get ?_a= parameter in Gelato orders
 *
 * Hypothesis: Images missing cloudinary_public_id fall back to stored URLs
 * which contain old signed URLs with authentication parameters
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

    const results = {
      summary: {
        totalImages: 0,
        withCloudinaryId: 0,
        missingCloudinaryId: 0,
        storedUrlsWithAuthParam: 0
      },
      affectedImages: [] as any[],
      recentOrders: [] as any[]
    };

    // Analyze recent images
    const { data: allImages, error: summaryError } = await supabase
      .from('image_catalog')
      .select('id, cloudinary_public_id, public_url, image_variants, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!summaryError && allImages) {
      results.summary.totalImages = allImages.length;

      for (const img of allImages) {
        if (img.cloudinary_public_id) {
          results.summary.withCloudinaryId++;
        } else {
          results.summary.missingCloudinaryId++;
          const storedUrl = (img.image_variants as any)?.original?.url || '';
          const hasAuthParam = storedUrl.includes('?_a=') || storedUrl.includes('auth_token');

          if (hasAuthParam) {
            results.summary.storedUrlsWithAuthParam++;
            results.affectedImages.push({
              id: img.id,
              created_at: img.created_at,
              has_cloudinary_id: false,
              stored_url_preview: storedUrl.substring(0, 100) + '...',
              has_auth_param: true,
              public_url: img.public_url
            });
          }
        }
      }
    }

    // Analyze recent orders
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, created_at, order_data')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!ordersError && orders) {
      for (const order of orders) {
        const orderData = order.order_data as any;
        const items = orderData?.items || [];

        if (items.length === 0) continue;

        const orderAnalysis: any = {
          order_id: order.id,
          created_at: order.created_at,
          item_count: items.length,
          items: []
        };

        for (const item of items) {
          const imageId = item.image_id;
          if (!imageId) continue;

          const { data: imageData, error: imageError } = await supabase
            .from('image_catalog')
            .select('id, cloudinary_public_id, public_url, image_variants')
            .eq('id', imageId)
            .single();

          if (imageError || !imageData) continue;

          const hasCloudinaryId = !!imageData.cloudinary_public_id;
          const storedUrl = (imageData.image_variants as any)?.original?.url || '';
          const hasAuthParam = storedUrl.includes('?_a=') || storedUrl.includes('auth_token');

          let urlSource = '';
          if (hasCloudinaryId) {
            urlSource = 'fresh_url';
          } else if (storedUrl) {
            urlSource = 'stored_url';
          } else {
            urlSource = 'no_url';
          }

          orderAnalysis.items.push({
            image_id: imageId,
            has_cloudinary_id: hasCloudinaryId,
            url_source: urlSource,
            has_issue: !hasCloudinaryId && hasAuthParam,
            auth_param_detected: hasAuthParam
          });
        }

        results.recentOrders.push(orderAnalysis);
      }
    }

    return NextResponse.json({
      success: true,
      diagnosis: {
        problem: 'Images missing cloudinary_public_id use stored URLs with auth parameters',
        impact: `${results.summary.storedUrlsWithAuthParam} images will fail with Gelato`,
        solution: 'Populate cloudinary_public_id field or regenerate image_variants'
      },
      ...results
    }, { status: 200 });

  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
