import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

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
    const body = await request.json();
    const { imageId, interactionType, platform, metadata = {} } = body;

    // Validate required fields
    if (!imageId || !interactionType) {
      return NextResponse.json(
        { error: 'imageId and interactionType are required' },
        { status: 400 }
      );
    }

    // Validate interaction type
    const validTypes = ['like', 'share', 'unlike', 'view', 'login', 'cart_add'];
    if (!validTypes.includes(interactionType)) {
      return NextResponse.json(
        { error: 'Invalid interaction type. Must be one of: ' + validTypes.join(', ') },
        { status: 400 }
      );
    }

    // If it's a share, platform is required
    if (interactionType === 'share' && !platform) {
      return NextResponse.json(
        { error: 'Platform is required for share interactions' },
        { status: 400 }
      );
    }

    // Get request headers for analytics
    const headersList = await headers();
    const userAgent = headersList.get('user-agent') || '';
    const referrer = headersList.get('referer') || '';
    const forwardedFor = headersList.get('x-forwarded-for');
    const realIp = headersList.get('x-real-ip');
    const ipAddress = forwardedFor?.split(',')[0] || realIp || '127.0.0.1';

    // Get user ID if authenticated, otherwise use session ID
    let userId = null;
    let sessionId = null;

    // For interactions API, we'll get the sessionId from the request body
    // and userId from the Authorization header if present
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        // Try to get user from client-side Supabase client
        const { createClient } = await import('@supabase/supabase-js');
        const clientSupabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data: { user } } = await clientSupabase.auth.getUser();
        userId = user?.id || null;
      } catch (error) {
        console.log('Could not get authenticated user, using session ID');
      }
    }

    // Use sessionId from request metadata
    sessionId = metadata.sessionId || body.sessionId || 'anon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // If no user ID and no session ID from metadata, generate one
    if (!userId && !sessionId) {
      sessionId = 'anon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    console.log('Recording interaction:', {
      imageId,
      interactionType,
      platform,
      userId: userId ? 'authenticated' : null,
      sessionId: sessionId ? 'present' : null
    });

    const supabase = getServiceRoleClient();

    // Insert the interaction using service role client
    const { data: interaction, error: insertError } = await supabase
      .from('user_interactions')
      .insert({
        user_id: userId,
        session_id: sessionId,
        image_id: imageId,
        interaction_type: interactionType,
        platform: platform || null,
        user_agent: userAgent,
        ip_address: ipAddress,
        referrer: referrer,
        metadata: metadata
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting interaction:', insertError);
      return NextResponse.json(
        { error: 'Failed to record interaction' },
        { status: 500 }
      );
    }

    // For share interactions, also update platform stats
    if (interactionType === 'share' && platform) {
      try {
        const { error: platformError } = await supabase
          .rpc('update_platform_analytics', {
            p_image_id: imageId,
            p_platform: platform
          });

        if (platformError) {
          console.error('Error updating platform stats:', platformError);
          // Don't fail the request, just log the error
        }
      } catch (error) {
        console.error('Error calling update_platform_stats:', error);
      }
    }

    // Get updated stats for the image
    const { data: stats } = await supabase
      .from('interaction_analytics')
      .select('total_likes, total_shares, total_views, unique_users')
      .eq('image_id', imageId)
      .single();

    return NextResponse.json({
      success: true,
      interaction: interaction,
      stats: stats ? {
        like_count: stats.total_likes,
        share_count: stats.total_shares,
        view_count: stats.total_views,
        unique_users: stats.unique_users
      } : {
        like_count: 0,
        share_count: 0,
        view_count: 0,
        unique_users: 0
      }
    });

  } catch (error) {
    console.error('Error in interactions API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve interaction stats for an image
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get('imageId');

    if (!imageId) {
      return NextResponse.json(
        { error: 'imageId parameter is required' },
        { status: 400 }
      );
    }

    const supabase = getServiceRoleClient();

    // Get interaction stats
    const { data: stats, error: statsError } = await supabase
      .from('interaction_analytics')
      .select('*')
      .eq('image_id', imageId)
      .single();

    if (statsError) {
      // If no stats found, return zeros
      if (statsError.code === 'PGRST116') {
        return NextResponse.json({
          like_count: 0,
          share_count: 0,
          view_count: 0,
          unique_users: 0,
          platforms: []
        });
      }
      throw statsError;
    }

    // Get platform breakdown for shares
    const { data: platforms, error: platformError } = await supabase
      .from('platform_analytics')
      .select('platform, total_platform_shares, last_shared_at')
      .eq('image_id', imageId)
      .order('total_platform_shares', { ascending: false });

    if (platformError) {
      console.error('Error fetching platform stats:', platformError);
    }

    return NextResponse.json({
      like_count: stats.total_likes || 0,
      share_count: stats.total_shares || 0,
      view_count: stats.total_views || 0,
      unique_users: stats.unique_users || 0,
      platforms: (platforms || []).map(p => ({
        platform: p.platform,
        share_count: p.total_platform_shares,
        last_shared_at: p.last_shared_at
      }))
    });

  } catch (error) {
    console.error('Error fetching interaction stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch interaction stats' },
      { status: 500 }
    );
  }
}