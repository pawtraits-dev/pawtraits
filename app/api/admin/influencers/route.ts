import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Influencer, AdminInfluencerOverview } from '@/lib/types';

interface InfluencerCreateRequest {
  first_name: string;
  last_name: string;
  bio?: string;
  custom_referral_code: string;
  commission_rate?: number;
  approval_status?: 'pending' | 'approved' | 'rejected' | 'suspended';
  is_active?: boolean;
  is_verified?: boolean;
  avatar_url?: string;
  payment_method?: string;
  payment_details?: any;
  notification_preferences?: {
    email_commissions?: boolean;
    email_referrals?: boolean;
  };
}

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

      // Find setup/onboarding code (description contains 'setup' or 'onboarding')
      const setupCode = codes.find((code: any) =>
        code.description && (
          code.description.toLowerCase().includes('setup') ||
          code.description.toLowerCase().includes('onboarding')
        )
      );

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
        primary_social_channel: primaryChannel || null,
        setup_code: setupCode?.code || null
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

    const body = await request.json() as InfluencerCreateRequest;

    // Validate required fields
    if (!body.first_name || !body.last_name || !body.custom_referral_code) {
      return NextResponse.json(
        { error: 'Missing required fields: first_name, last_name, custom_referral_code' },
        { status: 400 }
      );
    }

    // Validate referral code format
    const referralCodeRegex = /^[A-Z0-9]{4,20}$/;
    if (!referralCodeRegex.test(body.custom_referral_code)) {
      return NextResponse.json(
        { error: 'Referral code must be 4-20 characters, letters and numbers only' },
        { status: 400 }
      );
    }

    // Check if referral code already exists in influencer_referral_codes table
    const { data: existingCode } = await supabase
      .from('influencer_referral_codes')
      .select('id')
      .eq('code', body.custom_referral_code.toUpperCase().trim())
      .single();

    if (existingCode) {
      return NextResponse.json(
        { error: 'This referral code is already taken. Please choose a different one.' },
        { status: 409 }
      );
    }

    // Prepare influencer data
    const influencerData = {
      email: `${body.custom_referral_code.toLowerCase()}@temp.pawtraits.pics`, // Temporary email until they complete setup
      first_name: body.first_name.trim(),
      last_name: body.last_name.trim(),
      username: body.custom_referral_code.toLowerCase(),
      bio: body.bio?.trim() || null,
      avatar_url: body.avatar_url || null,
      phone: null,
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

    // Create custom referral code for the influencer
    const customCode = body.custom_referral_code.toUpperCase().trim();

    const { data: setupCodeData, error: codeError } = await supabase
      .from('influencer_referral_codes')
      .insert({
        influencer_id: newInfluencer.id,
        code: customCode,
        description: 'Custom referral code for follower acquisition',
        is_active: true,
        usage_count: 0,
        conversion_count: 0,
        total_revenue: 0,
        total_commission: 0
      })
      .select()
      .single();

    if (codeError) {
      console.error('Failed to create referral code for influencer:', codeError);
      // This is critical, so we should fail the operation
      return NextResponse.json(
        { error: 'Failed to create referral code. Please try again.' },
        { status: 500 }
      );
    }

    console.log('Successfully created influencer with custom referral code:', newInfluencer.id, customCode);
    return NextResponse.json({
      ...newInfluencer,
      setup_code: customCode
    }, { status: 201 });
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