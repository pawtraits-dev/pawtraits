import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role client to bypass RLS issues
function getServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getServiceRoleClient();
    
    console.log('Debugging homepage data...');
    
    // Check if image_catalog table exists and has data
    const { data: imageCount, error: countError } = await supabase
      .from('image_catalog')
      .select('id', { count: 'exact' });
    
    console.log('Image catalog count query result:', { imageCount: imageCount?.length, countError });
    
    // Get sample data from image_catalog
    const { data: sampleImages, error: sampleError } = await supabase
      .from('image_catalog')
      .select('*')
      .limit(5);
    
    console.log('Sample images:', { count: sampleImages?.length, sampleError });
    if (sampleImages && sampleImages.length > 0) {
      console.log('First image sample:', sampleImages[0]);
    }
    
    // Check for top_liked_images view
    const { data: topLikedData, error: topLikedError } = await supabase
      .from('top_liked_images')
      .select('*')
      .limit(3);
    
    console.log('Top liked images:', { count: topLikedData?.length, topLikedError });
    
    // Test basic queries that the homepage uses
    const results = await Promise.all([
      // New images
      supabase
        .from('image_catalog')
        .select('id, filename, public_url, prompt_text, description, is_featured, created_at')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(3),
      
      // Featured images
      supabase
        .from('image_catalog')
        .select('id, filename, public_url, prompt_text, description, is_featured, created_at')
        .eq('is_public', true)
        .eq('is_featured', true)
        .limit(3),
      
      // Check breeds table
      supabase
        .from('breeds')
        .select('id, name')
        .limit(3)
    ]);
    
    const [newImagesResult, featuredResult, breedsResult] = results;
    
    const debugInfo = {
      database_status: 'connected',
      image_catalog: {
        total_count: imageCount?.length || 0,
        count_error: countError?.message,
        sample_images: sampleImages?.length || 0,
        sample_error: sampleError?.message,
        first_image_sample: sampleImages?.[0] || null
      },
      top_liked_view: {
        available: !topLikedError,
        count: topLikedData?.length || 0,
        error: topLikedError?.message
      },
      homepage_queries: {
        new_images: {
          count: newImagesResult.data?.length || 0,
          error: newImagesResult.error?.message,
          sample: newImagesResult.data?.[0] || null
        },
        featured_images: {
          count: featuredResult.data?.length || 0,
          error: featuredResult.error?.message,
          sample: featuredResult.data?.[0] || null
        },
        breeds: {
          count: breedsResult.data?.length || 0,
          error: breedsResult.error?.message,
          sample: breedsResult.data || []
        }
      },
      timestamp: new Date().toISOString()
    };
    
    console.log('Debug info:', debugInfo);
    
    return NextResponse.json(debugInfo);
    
  } catch (error) {
    console.error('Error in homepage debug:', error);
    return NextResponse.json(
      { error: 'Debug failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}