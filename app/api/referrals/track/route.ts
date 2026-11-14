import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { referral_code, action, platform } = await request.json();

    if (!referral_code || !action) {
      return NextResponse.json(
        { error: 'Referral code and action are required' },
        { status: 400 }
      );
    }

    // For now, we'll just log the tracking event
    // In a real implementation, you'd want to create a tracking table
    console.log(`[CUSTOMER_REFERRAL_TRACKING] Code: ${referral_code}, Action: ${action}, Platform: ${platform || 'unknown'}`);

    // You could create a customer_referral_tracking table like this:
    /*
    const { error: trackingError } = await supabase
      .from('customer_referral_tracking')
      .insert({
        referral_code,
        action,
        platform: platform || 'unknown',
        tracked_at: new Date().toISOString(),
        ip_address: request.ip || 'unknown'
      });

    if (trackingError) {
      console.error('Error saving tracking data:', trackingError);
    }
    */

    // Shares only record when the code was last shared. (This used to add one to total_referrals with
    // supabase.raw(), which does not exist in supabase-js, so every share answered 500; that column is
    // recalculated from customer_referrals on the referrals page anyway.)
    if (action === 'share') {
      try {
        await supabase.from('customers').update({ last_shared_at: new Date().toISOString() }).eq('personal_referral_code', String(referral_code).toUpperCase());
      } catch (updateError) {
        console.error('Error recording share time:', updateError);
      }
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error tracking referral action:', error);
    return NextResponse.json(
      { error: 'Failed to track referral action' },
      { status: 500 }
    );
  }
}