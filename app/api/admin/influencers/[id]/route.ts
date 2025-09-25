import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { InfluencerUpdate } from '@/lib/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // TODO: Add admin authentication check
    const { id } = await params;
    console.log('Admin influencer API: Fetching influencer:', id);

    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get influencer with all related data
    const { data: influencer, error } = await supabase
      .from('influencers')
      .select(`
        *,
        influencer_social_channels (
          id,
          platform,
          username,
          profile_url,
          follower_count,
          engagement_rate,
          verified,
          is_primary,
          is_active,
          last_updated,
          created_at
        ),
        influencer_referral_codes (
          id,
          code,
          description,
          usage_count,
          conversion_count,
          total_revenue,
          total_commission,
          is_active,
          expires_at,
          created_at,
          updated_at
        ),
        influencer_referrals (
          id,
          customer_email,
          status,
          order_value,
          commission_amount,
          commission_paid,
          source_platform,
          utm_source,
          utm_medium,
          utm_campaign,
          created_at,
          purchased_at
        )
      `)
      .eq('id', id)
      .single();

    if (error || !influencer) {
      console.error('Influencer not found:', error);
      return NextResponse.json(
        { error: 'Influencer not found' },
        { status: 404 }
      );
    }

    // Calculate detailed stats
    const referralCodes = influencer.influencer_referral_codes || [];
    const referrals = influencer.influencer_referrals || [];
    const socialChannels = influencer.influencer_social_channels || [];

    // Referral stats
    const totalReferrals = referrals.length;
    const successfulReferrals = referrals.filter((r: any) => ['purchased', 'credited'].includes(r.status)).length;
    const pendingReferrals = referrals.filter((r: any) => ['pending', 'accessed', 'signed_up'].includes(r.status)).length;
    const expiredReferrals = referrals.filter((r: any) => r.status === 'expired').length;

    // Financial stats
    const totalRevenue = referrals.reduce((sum: number, r: any) => sum + (r.order_value || 0), 0);
    const totalCommissionEarned = referrals.reduce((sum: number, r: any) => sum + (r.commission_amount || 0), 0);
    const commissionPaid = referrals.filter((r: any) => r.commission_paid).reduce((sum: number, r: any) => sum + (r.commission_amount || 0), 0);
    const commissionPending = totalCommissionEarned - commissionPaid;
    const avgOrderValue = successfulReferrals > 0 ? totalRevenue / successfulReferrals : 0;

    // Social media stats
    const totalSocialReach = socialChannels
      .filter((channel: any) => channel.is_active)
      .reduce((sum: number, channel: any) => sum + (channel.follower_count || 0), 0);

    const avgEngagementRate = socialChannels
      .filter((channel: any) => channel.is_active && channel.engagement_rate)
      .reduce((sum: number, channel: any, index: number, array: any[]) =>
        sum + (channel.engagement_rate || 0) / array.length, 0);

    // Platform breakdown
    const platformStats = socialChannels.reduce((acc: any, channel: any) => {
      if (channel.is_active) {
        acc[channel.platform] = {
          username: channel.username,
          follower_count: channel.follower_count || 0,
          engagement_rate: channel.engagement_rate || 0,
          verified: channel.verified
        };
      }
      return acc;
    }, {});

    // Recent activity
    const recentReferrals = referrals
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);

    const response = {
      ...influencer,
      // Detailed stats
      stats: {
        referrals: {
          total: totalReferrals,
          successful: successfulReferrals,
          pending: pendingReferrals,
          expired: expiredReferrals,
          conversion_rate: totalReferrals > 0 ? successfulReferrals / totalReferrals : 0
        },
        financial: {
          total_revenue: totalRevenue,
          total_commission_earned: totalCommissionEarned,
          commission_paid: commissionPaid,
          commission_pending: commissionPending,
          avg_order_value: avgOrderValue
        },
        social_media: {
          total_reach: totalSocialReach,
          avg_engagement_rate: avgEngagementRate,
          platforms_count: socialChannels.filter((c: any) => c.is_active).length,
          platform_breakdown: platformStats
        },
        codes: {
          total_codes: referralCodes.length,
          active_codes: referralCodes.filter((c: any) => c.is_active).length,
          total_usage: referralCodes.reduce((sum: number, c: any) => sum + (c.usage_count || 0), 0),
          total_conversions: referralCodes.reduce((sum: number, c: any) => sum + (c.conversion_count || 0), 0)
        }
      },
      // Keep the detailed data arrays
      social_channels: socialChannels,
      referral_codes: referralCodes,
      recent_referrals: recentReferrals
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching influencer:', error);
    return NextResponse.json(
      { error: 'Failed to fetch influencer' },
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
    console.log('Admin influencer API: Updating influencer:', id);

    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const body = await request.json() as InfluencerUpdate;

    // Check if influencer exists
    const { data: existingInfluencer, error: fetchError } = await supabase
      .from('influencers')
      .select('id, email, username')
      .eq('id', id)
      .single();

    if (fetchError || !existingInfluencer) {
      return NextResponse.json(
        { error: 'Influencer not found' },
        { status: 404 }
      );
    }

    // Validate email if being updated
    if (body.email && body.email !== existingInfluencer.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        );
      }

      // Check if new email already exists
      const { data: emailExists } = await supabase
        .from('influencers')
        .select('id')
        .eq('email', body.email.toLowerCase().trim())
        .neq('id', id)
        .single();

      if (emailExists) {
        return NextResponse.json(
          { error: 'An influencer with this email already exists' },
          { status: 409 }
        );
      }
    }

    // Validate username if being updated
    if (body.username && body.username !== existingInfluencer.username) {
      const { data: usernameExists } = await supabase
        .from('influencers')
        .select('id')
        .eq('username', body.username.toLowerCase().trim())
        .neq('id', id)
        .single();

      if (usernameExists) {
        return NextResponse.json(
          { error: 'This username is already taken' },
          { status: 409 }
        );
      }
    }

    // Prepare update data (only include fields that are provided)
    const updateData: any = {};

    if (body.email) updateData.email = body.email.toLowerCase().trim();
    if (body.first_name) updateData.first_name = body.first_name.trim();
    if (body.last_name) updateData.last_name = body.last_name.trim();
    if (body.username !== undefined) updateData.username = body.username?.toLowerCase().trim() || null;
    if (body.bio !== undefined) updateData.bio = body.bio?.trim() || null;
    if (body.avatar_url !== undefined) updateData.avatar_url = body.avatar_url || null;
    if (body.phone !== undefined) updateData.phone = body.phone?.trim() || null;
    if (body.commission_rate !== undefined) updateData.commission_rate = body.commission_rate;
    if (body.payment_method !== undefined) updateData.payment_method = body.payment_method;
    if (body.payment_details !== undefined) updateData.payment_details = body.payment_details;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.is_verified !== undefined) updateData.is_verified = body.is_verified;

    // Handle notification preferences
    if (body.notification_preferences) {
      updateData.notification_preferences = {
        email_commissions: body.notification_preferences.email_commissions ?? true,
        email_referrals: body.notification_preferences.email_referrals ?? true,
      };
    }

    // Update the influencer
    const { data: updatedInfluencer, error: updateError } = await supabase
      .from('influencers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating influencer:', updateError);
      throw updateError;
    }

    console.log('Successfully updated influencer:', id);
    return NextResponse.json(updatedInfluencer);
  } catch (error) {
    console.error('Error updating influencer:', error);

    // Handle specific database errors
    if (error instanceof Error) {
      if (error.message.includes('duplicate key')) {
        return NextResponse.json(
          { error: 'Email or username already exists' },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to update influencer' },
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
    console.log('Admin influencer API: Deactivating influencer:', id);

    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Check if influencer exists
    const { data: existingInfluencer, error: fetchError } = await supabase
      .from('influencers')
      .select('id, is_active')
      .eq('id', id)
      .single();

    if (fetchError || !existingInfluencer) {
      return NextResponse.json(
        { error: 'Influencer not found' },
        { status: 404 }
      );
    }

    // Instead of deleting, deactivate the influencer
    const { data: deactivatedInfluencer, error: deactivateError } = await supabase
      .from('influencers')
      .update({
        is_active: false,
        approval_status: 'suspended'
      })
      .eq('id', id)
      .select()
      .single();

    if (deactivateError) {
      console.error('Error deactivating influencer:', deactivateError);
      throw deactivateError;
    }

    console.log('Successfully deactivated influencer:', id);
    return NextResponse.json({
      message: 'Influencer deactivated successfully',
      influencer: deactivatedInfluencer
    });
  } catch (error) {
    console.error('Error deactivating influencer:', error);
    return NextResponse.json(
      { error: 'Failed to deactivate influencer' },
      { status: 500 }
    );
  }
}