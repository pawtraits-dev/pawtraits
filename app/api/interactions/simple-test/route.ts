import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Simple test using service role to bypass RLS issues
export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({
        success: false,
        error: 'Service role configuration missing',
        hint: 'Make sure SUPABASE_SERVICE_ROLE_KEY is set in .env.local'
      }, { status: 500 });
    }

    // Create service role client (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('Testing with service role client...');

    // Test 1: Check if tables exist
    const { data: interactions, error: interactionsError } = await supabaseAdmin
      .from('user_interactions')
      .select('*')
      .limit(5);

    // Test 2: Check analytics table
    const { data: analytics, error: analyticsError } = await supabaseAdmin
      .from('interaction_analytics')
      .select('*')
      .limit(5);

    // Test 3: Check view
    const { data: viewData, error: viewError } = await supabaseAdmin
      .from('popular_images_complete_analytics')
      .select('id, current_like_count, current_view_count')
      .limit(5);

    // Test 4: Get some sample images
    const { data: images, error: imagesError } = await supabaseAdmin
      .from('image_catalog')
      .select('id, original_filename, like_count, view_count, share_count')
      .limit(3);

    // Test 5: Try the record function
    let functionTest = null;
    let functionError = null;
    
    if (images && images.length > 0) {
      const testImageId = images[0].id;
      const { data: funcData, error: funcError } = await supabaseAdmin
        .rpc('record_user_interaction', {
          p_user_id: null,
          p_session_id: `test_${Date.now()}`,
          p_image_id: testImageId,
          p_interaction_type: 'view',
          p_platform: null,
          p_user_agent: 'Test Agent',
          p_ip_address: '127.0.0.1',
          p_referrer: 'test',
          p_metadata: {}
        });
      
      functionTest = funcData;
      functionError = funcError;
    }

    return NextResponse.json({
      success: true,
      message: 'Service role testing complete',
      results: {
        userInteractions: {
          success: !interactionsError,
          count: interactions?.length || 0,
          error: interactionsError?.message
        },
        analytics: {
          success: !analyticsError,
          count: analytics?.length || 0,
          error: analyticsError?.message
        },
        view: {
          success: !viewError,
          count: viewData?.length || 0,
          error: viewError?.message
        },
        images: {
          success: !imagesError,
          count: images?.length || 0,
          error: imagesError?.message,
          sampleImages: images?.map(img => ({ id: img.id, filename: img.original_filename, counts: { likes: img.like_count, views: img.view_count, shares: img.share_count } }))
        },
        recordFunction: {
          success: !functionError,
          result: functionTest,
          error: functionError?.message
        }
      }
    });

  } catch (error) {
    console.error('Service role test error:', error);
    return NextResponse.json({
      success: false,
      error: 'Service role test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Test recording an interaction with a specific image
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageId, interactionType = 'like' } = body;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({
        success: false,
        error: 'Service role configuration missing'
      }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // If no imageId provided, get the first available one
    let targetImageId = imageId;
    if (!targetImageId) {
      const { data: images } = await supabaseAdmin
        .from('image_catalog')
        .select('id')
        .limit(1);
      
      if (images && images.length > 0) {
        targetImageId = images[0].id;
      } else {
        return NextResponse.json({
          success: false,
          error: 'No images found in catalog to test with'
        }, { status: 400 });
      }
    }

    // Record the interaction
    const { data: interactionId, error: recordError } = await supabaseAdmin
      .rpc('record_user_interaction', {
        p_user_id: null,
        p_session_id: `test_${Date.now()}_${Math.random().toString(36).substring(2)}`,
        p_image_id: targetImageId,
        p_interaction_type: interactionType,
        p_platform: interactionType === 'share' ? 'test_platform' : null,
        p_user_agent: 'Test User Agent',
        p_ip_address: '127.0.0.1',
        p_referrer: 'api_test',
        p_metadata: { test: true, timestamp: new Date().toISOString() }
      });

    if (recordError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to record interaction',
        details: recordError.message
      }, { status: 500 });
    }

    // Get updated image data
    const { data: updatedImage } = await supabaseAdmin
      .from('image_catalog')
      .select('like_count, view_count, share_count, last_liked_at, last_viewed_at')
      .eq('id', targetImageId)
      .single();

    // Get detailed analytics
    const { data: detailedAnalytics } = await supabaseAdmin
      .from('popular_images_complete_analytics')
      .select('detailed_total_likes, detailed_total_views, detailed_total_shares, detailed_unique_users')
      .eq('id', targetImageId)
      .single();

    return NextResponse.json({
      success: true,
      message: `Successfully recorded ${interactionType} interaction!`,
      data: {
        interactionId,
        imageId: targetImageId,
        interactionType,
        updatedCounts: updatedImage,
        detailedAnalytics
      }
    });

  } catch (error) {
    console.error('Error recording test interaction:', error);
    return NextResponse.json({
      success: false,
      error: 'Test interaction failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}