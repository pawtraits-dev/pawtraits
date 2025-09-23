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

    // Update the customer's total_referrals count if it's a share action
    if (action === 'share') {
      const { error: updateError } = await supabase
        .from('customers')
        .update({
          total_referrals: supabase.raw('total_referrals + 1'),
          last_shared_at: new Date().toISOString()
        })
        .eq('personal_referral_code', referral_code);

      if (updateError) {
        console.error('Error updating customer share count:', updateError);
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