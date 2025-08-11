import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-client';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    
    console.log('Testing user interactions system...');
    
    // Test 1: Check if tables exist
    const { data: tables, error: tablesError } = await supabase
      .from('user_interactions')
      .select('id')
      .limit(1);
    
    if (tablesError) {
      return NextResponse.json({
        success: false,
        error: 'user_interactions table not accessible',
        details: tablesError.message
      }, { status: 500 });
    }
    
    // Test 2: Check if views exist
    const { data: viewTest, error: viewError } = await supabase
      .from('popular_images_complete_analytics')
      .select('id')
      .limit(1);
    
    if (viewError) {
      return NextResponse.json({
        success: false,
        error: 'Views not accessible',
        details: viewError.message
      }, { status: 500 });
    }
    
    // Test 3: Check if we can call the record function
    const { data: functionTest, error: functionError } = await supabase
      .rpc('record_user_interaction', {
        p_user_id: null,
        p_session_id: 'test_session',
        p_image_id: null, // We'll test with null first
        p_interaction_type: 'view'
      });
    
    // This should fail with a foreign key constraint, which is expected
    // if we don't have a valid image_id
    
    // Test 4: Get some sample images to work with
    const { data: sampleImages, error: imagesError } = await supabase
      .from('image_catalog')
      .select('id, original_filename, like_count, view_count, share_count')
      .limit(5);
    
    if (imagesError) {
      return NextResponse.json({
        success: false,
        error: 'Cannot access image_catalog',
        details: imagesError.message
      }, { status: 500 });
    }
    
    // Test 5: Check analytics view with actual data
    const { data: analyticsTest, error: analyticsError } = await supabase
      .from('popular_images_complete_analytics')
      .select('id, current_like_count, current_view_count, legacy_share_count')
      .limit(5);
    
    return NextResponse.json({
      success: true,
      message: 'User interactions system is working!',
      tests: {
        tablesAccessible: !tablesError,
        viewsAccessible: !viewError,
        functionExists: functionError?.code !== '42883', // Function not found error
        imagesCatalogAccessible: !imagesError,
        analyticsViewWorking: !analyticsError
      },
      sampleData: {
        existingInteractionsCount: tables?.length || 0,
        sampleImages: sampleImages || [],
        analyticsPreview: analyticsTest || []
      },
      errors: {
        tables: tablesError?.message,
        views: viewError?.message,
        function: functionError?.message,
        images: imagesError?.message,
        analytics: analyticsError?.message
      }
    });
    
  } catch (error) {
    console.error('Error testing interactions system:', error);
    return NextResponse.json({
      success: false,
      error: 'System test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST endpoint to test recording an actual interaction
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();
    
    const { imageId, interactionType = 'view' } = body;
    
    if (!imageId) {
      return NextResponse.json({
        success: false,
        error: 'imageId is required for testing'
      }, { status: 400 });
    }
    
    // Test recording an interaction
    const { data: interactionId, error } = await supabase.rpc('record_user_interaction', {
      p_user_id: null,
      p_session_id: `test_${Date.now()}`,
      p_image_id: imageId,
      p_interaction_type: interactionType,
      p_platform: interactionType === 'share' ? 'test_platform' : null,
      p_user_agent: 'Test User Agent',
      p_ip_address: '127.0.0.1',
      p_referrer: 'test_referrer',
      p_metadata: { test: true }
    });
    
    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Failed to record interaction',
        details: error.message
      }, { status: 500 });
    }
    
    // Get updated image data
    const { data: updatedImage, error: imageError } = await supabase
      .from('image_catalog')
      .select('like_count, view_count, share_count')
      .eq('id', imageId)
      .single();
    
    // Get analytics data
    const { data: analytics, error: analyticsError } = await supabase
      .from('popular_images_complete_analytics')
      .select('*')
      .eq('id', imageId)
      .single();
    
    return NextResponse.json({
      success: true,
      message: 'Interaction recorded successfully!',
      interactionId,
      updatedCounts: updatedImage,
      fullAnalytics: analytics,
      errors: {
        image: imageError?.message,
        analytics: analyticsError?.message
      }
    });
    
  } catch (error) {
    console.error('Error testing interaction recording:', error);
    return NextResponse.json({
      success: false,
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}