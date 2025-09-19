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

export async function POST(request: NextRequest) {
  try {
    const supabase = getServiceRoleClient();
    const body = await request.json();
    
    const {
      imageId,
      interactionType, // 'like', 'unlike', 'share', 'view'
      platform, // optional, for shares
      sessionId, // for anonymous users
      metadata = {}
    } = body;

    // Validate required fields
    if (!imageId || !interactionType) {
      return NextResponse.json(
        { error: 'imageId and interactionType are required' },
        { status: 400 }
      );
    }

    // Validate interaction type
    if (!['like', 'unlike', 'share', 'view'].includes(interactionType)) {
      return NextResponse.json(
        { error: 'Invalid interaction type' },
        { status: 400 }
      );
    }

    // Try to get authenticated user for proper user_id tracking
    let userId = null;

    try {
      // Get user from auth headers if available
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (!authError && user) {
          userId = user.id;
          console.log('🔍 INTERACTIONS-RECORD API: Found authenticated user:', user.id, user.email);
        } else {
          console.log('🔍 INTERACTIONS-RECORD API: No valid auth token, proceeding as anonymous');
        }
      } else {
        console.log('🔍 INTERACTIONS-RECORD API: No auth header found, proceeding as anonymous');
      }
    } catch (authError) {
      console.log('🔍 INTERACTIONS-RECORD API: Auth check failed, proceeding as anonymous:', authError);
    }
    
    // Get request metadata
    const userAgent = request.headers.get('user-agent');
    const realIp = request.headers.get('x-real-ip') || 
                   request.headers.get('x-forwarded-for') || 
                   'unknown';
    const referrer = request.headers.get('referer');

    // Use the database function to record the interaction
    console.log('🔍 INTERACTIONS-RECORD API: Recording interaction:', {
      imageId,
      interactionType,
      userId,
      platform,
      sessionId: sessionId || `anon_${Date.now()}_${Math.random().toString(36).substring(2)}`
    });

    const { data: interactionId, error } = await supabase.rpc('record_user_interaction', {
      p_user_id: userId, // Use actual user_id for authenticated users
      p_session_id: sessionId || `anon_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      p_image_id: imageId,
      p_interaction_type: interactionType,
      p_platform: platform || null,
      p_user_agent: userAgent,
      p_ip_address: realIp !== 'unknown' ? realIp : null,
      p_referrer: referrer,
      p_metadata: metadata
    });

    if (error) {
      console.error('Error recording interaction:', error);
      return NextResponse.json(
        { error: 'Failed to record interaction' },
        { status: 500 }
      );
    }

    // Get updated counts for the image
    const { data: imageData, error: imageError } = await supabase
      .from('image_catalog')
      .select('like_count, view_count, share_count')
      .eq('id', imageId)
      .single();

    if (imageError) {
      console.error('Error fetching updated image data:', imageError);
    }

    return NextResponse.json({
      success: true,
      interactionId,
      updatedCounts: imageData || null
    });

  } catch (error) {
    console.error('Error in /api/interactions/record:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve interaction analytics for an image
export async function GET(request: NextRequest) {
  try {
    const supabase = getServiceRoleClient();
    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get('imageId');

    if (!imageId) {
      return NextResponse.json(
        { error: 'imageId parameter is required' },
        { status: 400 }
      );
    }

    // Get comprehensive analytics for the image
    const { data: analytics, error: analyticsError } = await supabase
      .from('popular_images_complete_analytics')
      .select('*')
      .eq('id', imageId)
      .single();

    if (analyticsError) {
      console.error('Error fetching analytics:', analyticsError);
      return NextResponse.json(
        { error: 'Failed to fetch analytics' },
        { status: 500 }
      );
    }

    // Get platform breakdown if available
    const { data: platformBreakdown, error: platformError } = await supabase
      .from('platform_analytics')
      .select('*')
      .eq('image_id', imageId);

    if (platformError) {
      console.error('Error fetching platform breakdown:', platformError);
    }

    return NextResponse.json({
      success: true,
      analytics,
      platformBreakdown: platformBreakdown || []
    });

  } catch (error) {
    console.error('Error in GET /api/interactions/record:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}