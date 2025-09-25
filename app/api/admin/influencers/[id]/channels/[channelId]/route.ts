import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; channelId: string } }
) {
  try {
    // TODO: Add admin authentication check
    console.log('Admin influencers API: Updating social channel...', params.channelId);

    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const body = await request.json();

    // Validate required fields
    if (!body.platform || !body.username) {
      return NextResponse.json(
        { error: 'Platform and username are required' },
        { status: 400 }
      );
    }

    // Update the social channel
    const { data: updatedChannel, error: updateError } = await supabase
      .from('influencer_social_channels')
      .update({
        platform: body.platform.toLowerCase(),
        username: body.username.toLowerCase().replace(/^@/, ''),
        profile_url: body.profile_url || null,
        follower_count: body.follower_count || 0,
        engagement_rate: body.engagement_rate || 0,
        verified: body.verified || false,
        is_primary: body.is_primary || false,
        is_active: body.is_active !== false,
        last_updated: new Date().toISOString(),
      })
      .eq('id', params.channelId)
      .eq('influencer_id', params.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating social channel:', updateError);
      throw updateError;
    }

    console.log('Successfully updated social channel:', params.channelId);
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
  { params }: { params: { id: string; channelId: string } }
) {
  try {
    // TODO: Add admin authentication check
    console.log('Admin influencers API: Deleting social channel...', params.channelId);

    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Delete the social channel
    const { error: deleteError } = await supabase
      .from('influencer_social_channels')
      .delete()
      .eq('id', params.channelId)
      .eq('influencer_id', params.id);

    if (deleteError) {
      console.error('Error deleting social channel:', deleteError);
      throw deleteError;
    }

    console.log('Successfully deleted social channel:', params.channelId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting social channel:', error);
    return NextResponse.json(
      { error: 'Failed to delete social channel' },
      { status: 500 }
    );
  }
}