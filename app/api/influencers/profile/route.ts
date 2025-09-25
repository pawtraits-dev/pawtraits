import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';
import type { InfluencerUpdate } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    console.log('Influencer profile API: Fetching profile...');

    const supabaseService = new SupabaseService();
    const { data: { user } } = await supabaseService.getClient().auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user profile to verify they are an influencer
    const userProfile = await supabaseService.getCurrentUserProfile();
    if (!userProfile || userProfile.user_type !== 'influencer') {
      return NextResponse.json(
        { error: 'Influencer access required' },
        { status: 403 }
      );
    }

    if (!userProfile.influencer_id) {
      return NextResponse.json(
        { error: 'Influencer profile not found' },
        { status: 404 }
      );
    }

    // Get influencer data with related information
    const { data: influencer, error } = await supabaseService.getClient()
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
        )
      `)
      .eq('id', userProfile.influencer_id)
      .single();

    if (error || !influencer) {
      console.error('Influencer not found:', error);
      return NextResponse.json(
        { error: 'Influencer profile not found' },
        { status: 404 }
      );
    }

    // Calculate basic stats
    const referralCodes = influencer.influencer_referral_codes || [];
    const socialChannels = influencer.influencer_social_channels || [];

    // Get recent referrals (limited to 10 for privacy)
    const { data: recentReferrals } = await supabaseService.getClient()
      .from('influencer_referrals')
      .select(`
        id,
        status,
        order_value,
        commission_amount,
        commission_paid,
        source_platform,
        created_at,
        purchased_at
      `)
      .eq('influencer_id', userProfile.influencer_id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Calculate summary stats
    const totalCodes = referralCodes.length;
    const activeCodes = referralCodes.filter(code => code.is_active).length;
    const totalUsage = referralCodes.reduce((sum, code) => sum + (code.usage_count || 0), 0);
    const totalConversions = referralCodes.reduce((sum, code) => sum + (code.conversion_count || 0), 0);
    const totalRevenue = referralCodes.reduce((sum, code) => sum + (code.total_revenue || 0), 0);
    const totalCommissionEarned = referralCodes.reduce((sum, code) => sum + (code.total_commission || 0), 0);

    const totalSocialReach = socialChannels
      .filter(channel => channel.is_active)
      .reduce((sum, channel) => sum + (channel.follower_count || 0), 0);

    const avgEngagementRate = socialChannels
      .filter(channel => channel.is_active && channel.engagement_rate)
      .reduce((sum, channel, index, array) => sum + (channel.engagement_rate || 0) / array.length, 0);

    // Calculate commission paid vs pending from recent referrals
    const paidCommission = recentReferrals?.filter(r => r.commission_paid).reduce((sum, r) => sum + (r.commission_amount || 0), 0) || 0;
    const pendingCommission = totalCommissionEarned - paidCommission;

    const response = {
      ...influencer,
      // Summary stats for dashboard
      stats: {
        referrals: {
          total_codes: totalCodes,
          active_codes: activeCodes,
          total_usage: totalUsage,
          total_conversions: totalConversions,
          conversion_rate: totalUsage > 0 ? totalConversions / totalUsage : 0
        },
        financial: {
          total_revenue: totalRevenue,
          total_commission_earned: totalCommissionEarned,
          commission_paid: paidCommission,
          commission_pending: pendingCommission,
          avg_revenue_per_conversion: totalConversions > 0 ? totalRevenue / totalConversions : 0
        },
        social_media: {
          total_channels: socialChannels.length,
          active_channels: socialChannels.filter(c => c.is_active).length,
          total_reach: totalSocialReach,
          avg_engagement_rate: avgEngagementRate,
          verified_channels: socialChannels.filter(c => c.verified).length
        }
      },
      // Detailed data
      social_channels: socialChannels,
      referral_codes: referralCodes,
      recent_referrals: recentReferrals || []
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching influencer profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    console.log('Influencer profile API: Updating profile...');

    const supabaseService = new SupabaseService();
    const { data: { user } } = await supabaseService.getClient().auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user profile to verify they are an influencer
    const userProfile = await supabaseService.getCurrentUserProfile();
    if (!userProfile || userProfile.user_type !== 'influencer') {
      return NextResponse.json(
        { error: 'Influencer access required' },
        { status: 403 }
      );
    }

    if (!userProfile.influencer_id) {
      return NextResponse.json(
        { error: 'Influencer profile not found' },
        { status: 404 }
      );
    }

    const body = await request.json() as InfluencerUpdate;

    // Influencers can only update certain fields (not commission_rate, approval status, etc.)
    const allowedFields = [
      'first_name',
      'last_name',
      'username',
      'bio',
      'avatar_url',
      'phone',
      'payment_method',
      'payment_details',
      'notification_preferences'
    ];

    // Filter update data to only allowed fields
    const updateData: any = {};
    Object.keys(body).forEach(key => {
      if (allowedFields.includes(key) && body[key as keyof InfluencerUpdate] !== undefined) {
        updateData[key] = body[key as keyof InfluencerUpdate];
      }
    });

    // Validate and clean data
    if (updateData.first_name) updateData.first_name = updateData.first_name.trim();
    if (updateData.last_name) updateData.last_name = updateData.last_name.trim();
    if (updateData.username) updateData.username = updateData.username.toLowerCase().trim();
    if (updateData.bio) updateData.bio = updateData.bio.trim();
    if (updateData.phone) updateData.phone = updateData.phone.trim();

    // Check username uniqueness if being updated
    if (updateData.username) {
      const { data: usernameExists } = await supabaseService.getClient()
        .from('influencers')
        .select('id')
        .eq('username', updateData.username)
        .neq('id', userProfile.influencer_id)
        .single();

      if (usernameExists) {
        return NextResponse.json(
          { error: 'This username is already taken' },
          { status: 409 }
        );
      }
    }

    // Handle notification preferences
    if (updateData.notification_preferences) {
      updateData.notification_preferences = {
        email_commissions: updateData.notification_preferences.email_commissions ?? true,
        email_referrals: updateData.notification_preferences.email_referrals ?? true,
      };
    }

    // Update the influencer profile
    const { data: updatedInfluencer, error: updateError } = await supabaseService.getClient()
      .from('influencers')
      .update(updateData)
      .eq('id', userProfile.influencer_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating influencer profile:', updateError);

      if (updateError.message.includes('duplicate key')) {
        return NextResponse.json(
          { error: 'Username already exists' },
          { status: 409 }
        );
      }

      throw updateError;
    }

    console.log('Successfully updated influencer profile:', userProfile.influencer_id);
    return NextResponse.json(updatedInfluencer);
  } catch (error) {
    console.error('Error updating influencer profile:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}