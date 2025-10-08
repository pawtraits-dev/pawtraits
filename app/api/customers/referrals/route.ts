import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerEmail = searchParams.get('email');

    if (!customerEmail) {
      return NextResponse.json(
        { error: 'Customer email required' },
        { status: 400 }
      );
    }

    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    console.log('Customer referrals API: Fetching data for customer:', customerEmail);

    // Get customer record
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, first_name, last_name, email, personal_referral_code, referral_scans_count')
      .eq('email', customerEmail)
      .single();

    if (customerError || !customer) {
      console.error('Error fetching customer:', customerError);
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    const customerId = customer.id;

    // Get primary referral code
    const primaryCode = customer.personal_referral_code ? {
      code: customer.personal_referral_code,
      qr_code_url: null,
      type: 'personal' as const,
      share_url: `/c/${customer.personal_referral_code}`
    } : null;

    // Get referred customers (friends who used this customer's referral code)
    const { data: referredCustomers, error: referredError } = await supabase
      .from('customers')
      .select('id, email, first_name, last_name, created_at')
      .eq('referral_type', 'CUSTOMER')
      .eq('referrer_id', customerId);

    if (referredError) {
      console.warn('Error fetching referred customers:', referredError);
    }

    const totalFriendsReferred = referredCustomers ? referredCustomers.length : 0;

    // Get orders from referred customers to track purchases
    let totalFriendsPurchased = 0;
    let referredCustomerEmails: string[] = [];

    if (referredCustomers && referredCustomers.length > 0) {
      referredCustomerEmails = referredCustomers.map(c => c.email).filter(Boolean);

      if (referredCustomerEmails.length > 0) {
        const { data: orders } = await supabase
          .from('orders')
          .select('customer_email')
          .in('customer_email', referredCustomerEmails);

        if (orders) {
          // Count unique customers who have made purchases
          const uniquePurchasers = new Set(orders.map(o => o.customer_email));
          totalFriendsPurchased = uniquePurchasers.size;
        }
      }
    }

    // Get customer_referrals records for reward tracking
    const { data: customerReferrals, error: referralsError } = await supabase
      .from('customer_referrals')
      .select(`
        id,
        customer_id,
        referrer_customer_id,
        referral_code,
        status,
        commission_earned,
        created_at
      `)
      .eq('referrer_customer_id', customerId)
      .order('created_at', { ascending: false });

    if (referralsError) {
      console.warn('Error fetching customer_referrals:', referralsError);
    }

    // Calculate reward totals from customer_referrals
    const totalRewardsEarned = customerReferrals
      ? customerReferrals.reduce((sum, ref) => sum + (ref.commission_earned || 0), 0)
      : 0;

    const pendingRewards = customerReferrals
      ? customerReferrals
          .filter(ref => ref.status === 'pending')
          .reduce((sum, ref) => sum + (ref.commission_earned || 0), 0)
      : 0;

    // Get customer's credit balance (rewards earned minus redeemed)
    const { data: creditBalance } = await supabase
      .from('customers')
      .select('credit_balance')
      .eq('id', customerId)
      .single();

    const availableBalance = creditBalance?.credit_balance || 0;
    const totalRedeemed = totalRewardsEarned - availableBalance - pendingRewards;

    // Build recent activity from referredCustomers and their orders
    const recentActivity = [];

    if (referredCustomers) {
      for (const refCustomer of referredCustomers.slice(0, 20)) {
        // Signup activity
        recentActivity.push({
          id: `signup-${refCustomer.id}`,
          type: 'signup' as const,
          date: refCustomer.created_at,
          customer_name: `${refCustomer.first_name || ''} ${refCustomer.last_name || ''}`.trim() || 'Customer',
          reward: 5.00, // £5 signup bonus
          status: 'earned'
        });

        // Check if they made a purchase
        const { data: customerOrders } = await supabase
          .from('orders')
          .select('id, created_at')
          .eq('customer_email', refCustomer.email)
          .order('created_at', { ascending: true })
          .limit(1);

        if (customerOrders && customerOrders.length > 0) {
          recentActivity.push({
            id: `purchase-${refCustomer.id}`,
            type: 'purchase' as const,
            date: customerOrders[0].created_at,
            customer_name: `${refCustomer.first_name || ''} ${refCustomer.last_name || ''}`.trim() || 'Customer',
            reward: 10.00, // £10 purchase bonus
            status: 'earned'
          });
        }
      }
    }

    // Sort by date descending
    recentActivity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Build rewards array for detailed tracking
    const rewards = [];

    if (referredCustomers) {
      for (const refCustomer of referredCustomers) {
        // Signup reward
        rewards.push({
          id: `reward-signup-${refCustomer.id}`,
          customer_id: customerId,
          friend_customer_id: refCustomer.id,
          order_id: null,
          reward_amount: 5.00,
          reward_type: 'signup' as const,
          status: 'earned' as const,
          created_at: refCustomer.created_at,
          redeemed_at: null
        });

        // Purchase reward (if they purchased)
        const { data: customerOrders } = await supabase
          .from('orders')
          .select('id, created_at')
          .eq('customer_email', refCustomer.email)
          .order('created_at', { ascending: true })
          .limit(1);

        if (customerOrders && customerOrders.length > 0) {
          rewards.push({
            id: `reward-purchase-${refCustomer.id}`,
            customer_id: customerId,
            friend_customer_id: refCustomer.id,
            order_id: customerOrders[0].id,
            reward_amount: 10.00,
            reward_type: 'purchase' as const,
            status: 'earned' as const,
            created_at: customerOrders[0].created_at,
            redeemed_at: null
          });
        }
      }
    }

    const response = {
      user_type: 'customer',
      customer_name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.email,
      primary_code: primaryCode,
      summary: {
        total_scans: customer.referral_scans_count || 0,
        total_friends_referred: totalFriendsReferred,
        total_friends_purchased: totalFriendsPurchased,
        total_rewards_earned: totalRewardsEarned,
        pending_rewards: pendingRewards,
        available_balance: availableBalance,
        total_redeemed: Math.max(0, totalRedeemed)
      },
      recent_activity: recentActivity,
      rewards: rewards
    };

    console.log('Customer referrals API: Returning data for customer', customerId);
    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching customer referral data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch referral data' },
      { status: 500 }
    );
  }
}
