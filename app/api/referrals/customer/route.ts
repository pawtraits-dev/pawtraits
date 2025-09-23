import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { searchParams } = new URL(request.url);
    const customerEmail = searchParams.get('email');

    if (!customerEmail) {
      return NextResponse.json({ error: 'Customer email is required' }, { status: 400 });
    }

    // Get customer data with personal referral code
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select(`
        id,
        first_name,
        last_name,
        email,
        personal_referral_code,
        total_referrals,
        successful_referrals,
        rewards_earned,
        signup_discount_used
      `)
      .eq('email', customerEmail)
      .single();

    if (customerError) {
      console.error('Error fetching customer data:', customerError);
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // If customer doesn't have a referral code, generate one
    if (!customer.personal_referral_code) {
      console.log(`Generating referral code for customer: ${customerEmail}`);

      // Generate unique referral code
      const namePrefix = (customer.first_name?.charAt(0) || '') + (customer.last_name?.charAt(0) || '');
      const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
      const referralCode = `${namePrefix}${randomSuffix}`.toUpperCase();

      // Update customer with new referral code (only update fields that exist)
      const { error: updateError } = await supabase
        .from('customers')
        .update({
          personal_referral_code: referralCode
        })
        .eq('id', customer.id);

      if (updateError) {
        console.error('Error updating customer with referral code:', updateError);
        return NextResponse.json(
          { error: 'Failed to generate referral code' },
          { status: 500 }
        );
      }

      // Update the customer object with the new referral code
      customer.personal_referral_code = referralCode;
      customer.total_referrals = customer.total_referrals || 0;
      customer.successful_referrals = customer.successful_referrals || 0;
      customer.rewards_earned = customer.rewards_earned || 0;
      customer.signup_discount_used = customer.signup_discount_used || 0;
    }

    // Get referral analytics from customer_referrals table (if it exists)
    const analytics = {
      total_shares: customer?.total_referrals || 0,
      qr_scans: 0, // This would come from QR scan tracking
      link_clicks: 0, // This would come from link click tracking
      signups: customer?.successful_referrals || 0,
      successful_purchases: customer?.successful_referrals || 0,
      total_rewards_earned: customer?.rewards_earned || 0
    };

    return NextResponse.json({
      success: true,
      customer: {
        personal_referral_code: customer.personal_referral_code,
        total_referrals: customer.total_referrals || 0,
        successful_referrals: customer.successful_referrals || 0,
        rewards_earned: customer.rewards_earned || 0,
        signup_discount_used: customer.signup_discount_used || 0
      },
      analytics
    });

  } catch (error) {
    console.error('Error getting customer referral data:', error);
    return NextResponse.json(
      { error: 'Failed to get customer referral data' },
      { status: 500 }
    );
  }
}