import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { SocialChannelCreate } from '@/lib/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // TODO: Add admin authentication check
    const { id } = await params;
    console.log('Admin influencer social API: Fetching social channels for:', id);

    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify influencer exists
    const { data: influencer, error: influencerError } = await supabase
      .from('influencers')
      .select('id, first_name, last_name')
      .eq('id', id)
      .single();

    if (influencerError || !influencer) {
      return NextResponse.json(
        { error: 'Influencer not found' },
        { status: 404 }
      );
    }

    // Get all social channels for this influencer
    const { data: socialChannels, error } = await supabase
      .from('influencer_social_channels')
      .select('*')
      .eq('influencer_id', id)
      .order('is_primary', { ascending: false })
      .order('follower_count', { ascending: false });

    if (error) {
      console.error('Error fetching social channels:', error);
      throw error;
    }

    // Calculate summary stats
    const totalReach = socialChannels?.reduce((sum, channel) => sum + (channel.follower_count || 0), 0) || 0;
    const activeChannels = socialChannels?.filter(channel => channel.is_active) || [];
    const verifiedChannels = socialChannels?.filter(channel => channel.verified) || [];
    const primaryChannel = socialChannels?.find(channel => channel.is_primary) || null;

    const avgEngagementRate = activeChannels.length > 0
      ? activeChannels.reduce((sum, channel) => sum + (channel.engagement_rate || 0), 0) / activeChannels.length
      : 0;

    const response = {
      influencer: {
        id: influencer.id,
        name: `${influencer.first_name} ${influencer.last_name}`
      },
      social_channels: socialChannels || [],
      summary: {
        total_channels: socialChannels?.length || 0,
        active_channels: activeChannels.length,
        verified_channels: verifiedChannels.length,
        total_reach: totalReach,
        avg_engagement_rate: avgEngagementRate,
        primary_platform: primaryChannel?.platform || null
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching social channels:', error);
    return NextResponse.json(
      { error: 'Failed to fetch social channels' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // TODO: Add admin authentication check
    const { id } = await params;
    console.log('Admin influencer social API: Adding social channel for:', id);

    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const body = await request.json() as SocialChannelCreate;

    // Verify influencer exists
    const { data: influencer, error: influencerError } = await supabase
      .from('influencers')
      .select('id')
      .eq('id', id)
      .single();

    if (influencerError || !influencer) {
      return NextResponse.json(
        { error: 'Influencer not found' },
        { status: 404 }
      );
    }

    // Validate required fields
    if (!body.platform || !body.username) {
      return NextResponse.json(
        { error: 'Missing required fields: platform, username' },
        { status: 400 }
      );
    }

    // Validate platform
    const validPlatforms = ['instagram', 'tiktok', 'youtube', 'twitter', 'facebook', 'linkedin', 'pinterest'];
    if (!validPlatforms.includes(body.platform)) {
      return NextResponse.json(
        { error: `Invalid platform. Must be one of: ${validPlatforms.join(', ')}` },
        { status: 400 }
      );
    }

    // Check if this platform already exists for this influencer
    const { data: existingChannel } = await supabase
      .from('influencer_social_channels')
      .select('id')
      .eq('influencer_id', id)
      .eq('platform', body.platform)
      .single();

    if (existingChannel) {
      return NextResponse.json(
        { error: `This influencer already has a ${body.platform} channel` },
        { status: 409 }
      );
    }

    // If this is being set as primary, remove primary status from other channels
    if (body.is_primary) {
      await supabase
        .from('influencer_social_channels')
        .update({ is_primary: false })
        .eq('influencer_id', id);
    }

    // Prepare channel data
    const channelData = {
      influencer_id: id,
      platform: body.platform,
      username: body.username.trim(),
      profile_url: body.profile_url?.trim() || null,
      follower_count: body.follower_count || 0,
      engagement_rate: body.engagement_rate || null,
      verified: body.verified || false,
      is_primary: body.is_primary || false,
      is_active: body.is_active !== undefined ? body.is_active : true
    };

    // Create the social channel
    const { data: newChannel, error: createError } = await supabase
      .from('influencer_social_channels')
      .insert(channelData)
      .select()
      .single();

    if (createError) {
      console.error('Error creating social channel:', createError);
      throw createError;
    }

    console.log('Successfully created social channel:', newChannel.id);
    return NextResponse.json(newChannel, { status: 201 });
  } catch (error) {
    console.error('Error creating social channel:', error);

    // Handle specific database errors
    if (error instanceof Error) {
      if (error.message.includes('duplicate key')) {
        return NextResponse.json(
          { error: 'This influencer already has this platform' },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to create social channel' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // TODO: Add admin authentication check
    const { id } = await params;
    const body = await request.json();
    const { channel_id, ...updateData } = body;

    console.log('Admin influencer social API: Updating social channel:', channel_id);

    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    if (!channel_id) {
      return NextResponse.json(
        { error: 'Missing channel_id' },
        { status: 400 }
      );
    }

    // Verify the channel belongs to this influencer
    const { data: existingChannel, error: fetchError } = await supabase
      .from('influencer_social_channels')
      .select('*')
      .eq('id', channel_id)
      .eq('influencer_id', id)
      .single();

    if (fetchError || !existingChannel) {
      return NextResponse.json(
        { error: 'Social channel not found' },
        { status: 404 }
      );
    }

    // If this is being set as primary, remove primary status from other channels
    if (updateData.is_primary && !existingChannel.is_primary) {
      await supabase
        .from('influencer_social_channels')
        .update({ is_primary: false })
        .eq('influencer_id', id);
    }

    // Prepare update data
    const channelUpdateData: any = {};
    if (updateData.username !== undefined) channelUpdateData.username = updateData.username.trim();
    if (updateData.profile_url !== undefined) channelUpdateData.profile_url = updateData.profile_url?.trim() || null;
    if (updateData.follower_count !== undefined) channelUpdateData.follower_count = updateData.follower_count;
    if (updateData.engagement_rate !== undefined) channelUpdateData.engagement_rate = updateData.engagement_rate;
    if (updateData.verified !== undefined) channelUpdateData.verified = updateData.verified;
    if (updateData.is_primary !== undefined) channelUpdateData.is_primary = updateData.is_primary;
    if (updateData.is_active !== undefined) channelUpdateData.is_active = updateData.is_active;

    // Add last_updated timestamp
    channelUpdateData.last_updated = new Date().toISOString();

    // Update the social channel
    const { data: updatedChannel, error: updateError } = await supabase
      .from('influencer_social_channels')
      .update(channelUpdateData)
      .eq('id', channel_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating social channel:', updateError);
      throw updateError;
    }

    console.log('Successfully updated social channel:', channel_id);
    return NextResponse.json(updatedChannel);
  } catch (error) {
    console.error('Error updating social channel:', error);
    return NextResponse.json(
      { error: 'Failed to update social channel' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // TODO: Add admin authentication check
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get('channel_id');

    console.log('Admin influencer social API: Deleting social channel:', channelId);

    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    if (!channelId) {
      return NextResponse.json(
        { error: 'Missing channel_id parameter' },
        { status: 400 }
      );
    }

    // Verify the channel belongs to this influencer
    const { data: existingChannel, error: fetchError } = await supabase
      .from('influencer_social_channels')
      .select('*')
      .eq('id', channelId)
      .eq('influencer_id', id)
      .single();

    if (fetchError || !existingChannel) {
      return NextResponse.json(
        { error: 'Social channel not found' },
        { status: 404 }
      );
    }

    // Delete the social channel
    const { error: deleteError } = await supabase
      .from('influencer_social_channels')
      .delete()
      .eq('id', channelId);

    if (deleteError) {
      console.error('Error deleting social channel:', deleteError);
      throw deleteError;
    }

    console.log('Successfully deleted social channel:', channelId);
    return NextResponse.json({ message: 'Social channel deleted successfully' });
  } catch (error) {
    console.error('Error deleting social channel:', error);
    return NextResponse.json(
      { error: 'Failed to delete social channel' },
      { status: 500 }
    );
  }
}