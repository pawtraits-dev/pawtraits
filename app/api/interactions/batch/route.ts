import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';
import { headers } from 'next/headers';

const supabaseService = new SupabaseService();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { interactions } = body;

    // Validate input
    if (!Array.isArray(interactions) || interactions.length === 0) {
      return NextResponse.json(
        { error: 'interactions array is required and must not be empty' },
        { status: 400 }
      );
    }

    if (interactions.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 interactions allowed per batch request' },
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

    // Get user ID if authenticated
    let userId = null;
    try {
      const { data: { user } } = await supabaseService['supabase'].auth.getUser();
      userId = user?.id || null;
    } catch (error) {
      // User not authenticated
    }

    const validTypes = ['like', 'share', 'unlike', 'view'];
    const processedInteractions = [];
    const errors = [];

    // Process and validate each interaction
    for (let i = 0; i < interactions.length; i++) {
      const interaction = interactions[i];
      
      // Validate each interaction
      if (!interaction.imageId || !interaction.interactionType) {
        errors.push(`Interaction ${i}: imageId and interactionType are required`);
        continue;
      }

      if (!validTypes.includes(interaction.interactionType)) {
        errors.push(`Interaction ${i}: Invalid interaction type. Must be one of: ${validTypes.join(', ')}`);
        continue;
      }

      if (interaction.interactionType === 'share' && !interaction.platform) {
        errors.push(`Interaction ${i}: Platform is required for share interactions`);
        continue;
      }

      // Generate session ID if needed
      let sessionId = interaction.sessionId;
      if (!userId && !sessionId) {
        sessionId = 'anon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      }

      processedInteractions.push({
        user_id: userId,
        session_id: sessionId,
        image_id: interaction.imageId,
        interaction_type: interaction.interactionType,
        platform: interaction.platform || null,
        user_agent: userAgent,
        ip_address: ipAddress,
        referrer: referrer,
        metadata: interaction.metadata || {}
      });
    }

    // If there were validation errors, return them
    if (errors.length > 0) {
      return NextResponse.json(
        { 
          error: 'Validation errors occurred',
          details: errors,
          processed: 0,
          total: interactions.length
        },
        { status: 400 }
      );
    }

    console.log('Recording batch interactions:', {
      count: processedInteractions.length,
      userId: userId ? 'authenticated' : 'anonymous'
    });

    // Insert all interactions in batch
    const { data: insertedInteractions, error: insertError } = await supabaseService['supabase']
      .from('user_interactions')
      .insert(processedInteractions)
      .select();

    if (insertError) {
      console.error('Error inserting batch interactions:', insertError);
      return NextResponse.json(
        { error: 'Failed to record interactions' },
        { status: 500 }
      );
    }

    // Update platform stats for share interactions
    const shareInteractions = processedInteractions.filter(i => i.interaction_type === 'share');
    const platformUpdatePromises = [];

    for (const shareInt of shareInteractions) {
      if (shareInt.platform) {
        platformUpdatePromises.push(
          supabaseService['supabase'].rpc('update_platform_analytics', {
            p_image_id: shareInt.image_id,
            p_platform: shareInt.platform
          })
        );
      }
    }

    // Execute platform updates (don't wait for completion to avoid blocking)
    if (platformUpdatePromises.length > 0) {
      Promise.all(platformUpdatePromises).catch(error => {
        console.error('Error updating platform stats in batch:', error);
      });
    }

    // Get updated stats for unique images
    const imageIdSet = new Set(processedInteractions.map(i => i.image_id));
    const uniqueImageIds = Array.from(imageIdSet);
    const { data: statsData } = await supabaseService['supabase']
      .from('interaction_analytics')
      .select('image_id, total_likes, total_shares, total_views, unique_users')
      .in('image_id', uniqueImageIds);

    const statsMap = (statsData || []).reduce((map: Record<string, any>, stat: any) => {
      map[stat.image_id] = {
        like_count: stat.total_likes,
        share_count: stat.total_shares,
        view_count: stat.total_views,
        unique_users: stat.unique_users
      };
      return map;
    }, {} as Record<string, any>);

    return NextResponse.json({
      success: true,
      processed: insertedInteractions?.length || 0,
      total: interactions.length,
      interactions: insertedInteractions,
      updatedStats: statsMap
    });

  } catch (error) {
    console.error('Error in batch interactions API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}