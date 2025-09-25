import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Influencer, InfluencerCreate, AdminInfluencerOverview } from '@/lib/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    // TODO: Add admin authentication check
    console.log('Admin influencers API: Fetching all influencers...');

    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    // Build query
    let query = supabase
      .from('influencers')
      .select(`
        *,
        influencer_social_channels (
          id,
          platform,
          username,
          follower_count,
          verified,
          is_primary,
          is_active
        ),
        influencer_referral_codes (
          id,
          code,
          usage_count,
          conversion_count,
          total_commission,
          is_active
        )
      `)
      .order('created_at', { ascending: false });

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('approval_status', status);
    }

    // Apply pagination
    if (limit) {
      query = query.limit(parseInt(limit));
    }
    if (offset) {
      query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit || '50') - 1);
    }

    const { data: influencers, error } = await query;

    if (error) {
      console.error('Error fetching influencers:', error);
      throw error;
    }

    // Process influencers to include calculated stats
    const processedInfluencers = influencers?.map((influencer: any) => {
      // Calculate stats from referral codes
      const codes = influencer.influencer_referral_codes || [];
      const totalReferrals = codes.reduce((sum: number, code: any) => sum + (code.usage_count || 0), 0);
      const successfulReferrals = codes.reduce((sum: number, code: any) => sum + (code.conversion_count || 0), 0);
      const totalCommissionEarned = codes.reduce((sum: number, code: any) => sum + (code.total_commission || 0), 0);

      // Calculate social media stats
      const socialChannels = influencer.influencer_social_channels || [];
      const totalSocialReach = socialChannels
        .filter((channel: any) => channel.is_active)
        .reduce((sum: number, channel: any) => sum + (channel.follower_count || 0), 0);

      const primaryChannel = socialChannels.find((channel: any) => channel.is_primary && channel.is_active);

      return {
        ...influencer,
        // Remove nested arrays to clean up response
        influencer_social_channels: undefined,
        influencer_referral_codes: undefined,
        // Add calculated stats
        total_referrals: totalReferrals,
        successful_referrals: successfulReferrals,
        pending_referrals: totalReferrals - successfulReferrals,
        total_commission_earned: totalCommissionEarned,
        conversion_rate: totalReferrals > 0 ? successfulReferrals / totalReferrals : 0,
        social_channels_count: socialChannels.length,
        active_codes_count: codes.filter((code: any) => code.is_active).length,
        total_social_reach: totalSocialReach,
        primary_platform: primaryChannel?.platform || null,
        primary_social_channel: primaryChannel || null
      };
    }) || [];

    console.log('Admin influencers API: Found', processedInfluencers.length, 'influencers');
    return NextResponse.json(processedInfluencers);
  } catch (error) {
    console.error('Error fetching influencers for admin:', error);
    return NextResponse.json(
      { error: 'Failed to fetch influencers' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // TODO: Add admin authentication check
    console.log('Admin influencers API: Creating new influencer...');

    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const body = await request.json() as InfluencerCreate;

    // Validate required fields
    if (!body.email || !body.first_name || !body.last_name) {
      return NextResponse.json(
        { error: 'Missing required fields: email, first_name, last_name' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const { data: existingInfluencer } = await supabase
      .from('influencers')
      .select('id')
      .eq('email', body.email.toLowerCase().trim())
      .single();

    if (existingInfluencer) {
      return NextResponse.json(
        { error: 'An influencer with this email already exists' },
        { status: 409 }
      );
    }

    // Check if username is unique (if provided)
    if (body.username) {
      const { data: existingUsername } = await supabase
        .from('influencers')
        .select('id')
        .eq('username', body.username.toLowerCase().trim())
        .single();

      if (existingUsername) {
        return NextResponse.json(
          { error: 'This username is already taken' },
          { status: 409 }
        );
      }
    }

    // Prepare influencer data
    const influencerData = {
      email: body.email.toLowerCase().trim(),
      first_name: body.first_name.trim(),
      last_name: body.last_name.trim(),
      username: body.username?.toLowerCase().trim() || null,
      bio: body.bio?.trim() || null,
      avatar_url: body.avatar_url || null,
      phone: body.phone?.trim() || null,
      commission_rate: body.commission_rate || 10.00,
      payment_method: body.payment_method || null,
      payment_details: body.payment_details || null,
      notification_preferences: {
        email_commissions: body.notification_preferences?.email_commissions ?? true,
        email_referrals: body.notification_preferences?.email_referrals ?? true,
      },
      approval_status: 'approved', // Admin-created influencers are auto-approved
      is_active: body.is_active ?? true,
      is_verified: body.is_verified ?? false,
    };

    // Create the influencer
    const { data: newInfluencer, error: createError } = await supabase
      .from('influencers')
      .insert(influencerData)
      .select()
      .single();

    if (createError) {
      console.error('Error creating influencer:', createError);
      throw createError;
    }

    console.log('Successfully created influencer:', newInfluencer.id);
    return NextResponse.json(newInfluencer, { status: 201 });
  } catch (error) {
    console.error('Error creating influencer:', error);

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
      { error: 'Failed to create influencer' },
      { status: 500 }
    );
  }
}