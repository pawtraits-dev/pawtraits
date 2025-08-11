import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const {
      imageId,
      platform,
      shareUrl,
      socialAccountData
    } = await request.json();

    // Get current user (if authenticated)
    const { data: { user } } = await supabase.auth.getUser();

    // Get client info
    const userAgent = request.headers.get('user-agent');
    const xForwardedFor = request.headers.get('x-forwarded-for');
    const xRealIp = request.headers.get('x-real-ip');
    const ipAddress = xForwardedFor?.split(',')[0] || xRealIp;
    const referrer = request.headers.get('referer');

    // Create share event
    const { data: shareEvent, error: shareError } = await supabase
      .from('share_events')
      .insert({
        image_id: imageId,
        user_id: user?.id || null,
        user_email: user?.email || null,
        platform,
        share_url: shareUrl,
        user_agent: userAgent,
        ip_address: ipAddress,
        referrer
      })
      .select()
      .single();

    if (shareError) {
      console.error('Error creating share event:', shareError);
      throw shareError;
    }

    // If social account data is provided, handle social account tracking
    if (socialAccountData && shareEvent) {
      const {
        platformUserId,
        username,
        displayName,
        profileUrl,
        followerCount,
        verified
      } = socialAccountData;

      // Check if social account already exists
      let { data: socialAccount, error: accountFindError } = await supabase
        .from('social_accounts')
        .select('*')
        .eq('platform', platform)
        .eq('platform_user_id', platformUserId)
        .single();

      if (accountFindError && accountFindError.code !== 'PGRST116') {
        console.error('Error finding social account:', accountFindError);
      }

      // Create or update social account
      if (!socialAccount) {
        const { data: newAccount, error: createError } = await supabase
          .from('social_accounts')
          .insert({
            platform,
            platform_user_id: platformUserId,
            username,
            display_name: displayName,
            profile_url: profileUrl,
            follower_count: followerCount,
            verified: verified || false,
            first_shared_at: new Date().toISOString(),
            last_shared_at: new Date().toISOString(),
            total_shares: 1
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating social account:', createError);
        } else {
          socialAccount = newAccount;
        }
      } else {
        // Update existing account
        const { error: updateError } = await supabase
          .from('social_accounts')
          .update({
            username,
            display_name: displayName,
            profile_url: profileUrl,
            follower_count: followerCount,
            verified: verified || false,
            last_shared_at: new Date().toISOString()
          })
          .eq('id', socialAccount.id);

        if (updateError) {
          console.error('Error updating social account:', updateError);
        }
      }

      // Link share event to social account
      if (socialAccount) {
        const { error: linkError } = await supabase
          .from('share_social_accounts')
          .insert({
            share_event_id: shareEvent.id,
            social_account_id: socialAccount.id
          });

        if (linkError) {
          console.error('Error linking share to social account:', linkError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      shareEventId: shareEvent.id
    });

  } catch (error) {
    console.error('Error tracking share:', error);
    return NextResponse.json(
      { error: 'Failed to track share' },
      { status: 500 }
    );
  }
}