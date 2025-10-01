import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// User-context referral analytics endpoint
// Returns privacy-protected analytics for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify the user token and get user profile
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
    }

    // Get user profile to determine user type
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, user_type, partner_id, customer_id, influencer_id')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    console.log(`🔍 Fetching referral analytics for ${userProfile.user_type}:`, userProfile.id);

    let analytics;

    if (userProfile.user_type === 'partner') {
      analytics = await getPartnerAnalytics(supabase, userProfile.id);
    } else if (userProfile.user_type === 'customer') {
      analytics = await getCustomerAnalytics(supabase, userProfile.id);
    } else if (userProfile.user_type === 'influencer') {
      analytics = await getInfluencerAnalytics(supabase, userProfile.id);
    } else {
      return NextResponse.json({ error: 'Invalid user type for referrals' }, { status: 403 });
    }

    return NextResponse.json(analytics);

  } catch (error) {
    console.error('💥 Error fetching referral analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch referral analytics' },
      { status: 500 }
    );
  }
}

async function getPartnerAnalytics(supabase: any, userProfileId: string) {
  // Get all customers referred by this partner
  const { data: referredCustomers, error } = await supabase
    .from('customers')
    .select(`
      id,
      referral_type,
      referral_applied_at,
      referral_order_id,
      referral_discount_applied,
      referral_commission_rate,
      referred_order:orders!referral_order_id (
        total_amount,
        created_at,
        status
      )
    `)
    .eq('referral_type', 'PARTNER')
    .eq('referrer_id', userProfileId);

  if (error) {
    console.error('Error fetching partner referrals:', error);
    throw error;
  }

  const customers = referredCustomers || [];

  // Calculate summary stats
  const totalScans = customers.length; // Each customer represents a scan/access that led to signup
  const totalSignups = customers.length;
  const totalPurchases = customers.filter(c => c.referred_order).length;

  // Calculate commissions
  const totalCommissions = customers.reduce((sum, customer) => {
    if (customer.referred_order && customer.referral_commission_rate > 0) {
      const orderValue = customer.referred_order.total_amount / 100; // Convert pence to pounds
      const commission = orderValue * (customer.referral_commission_rate / 100);
      return sum + commission;
    }
    return sum;
  }, 0);

  const totalOrderValue = customers.reduce((sum, customer) => {
    if (customer.referred_order) {
      return sum + (customer.referred_order.total_amount / 100); // Convert pence to pounds
    }
    return sum;
  }, 0);

  // Create privacy-protected activity log (no customer data)
  const recentActivity = customers.map(customer => ({
    id: customer.id,
    type: customer.referred_order ? 'purchase' : 'signup',
    date: customer.referred_order ? customer.referred_order.created_at : customer.referral_applied_at,
    order_value: customer.referred_order ? customer.referred_order.total_amount / 100 : null,
    commission: customer.referred_order && customer.referral_commission_rate > 0
      ? (customer.referred_order.total_amount / 100) * (customer.referral_commission_rate / 100)
      : null,
    // No customer email, name, or other identifying information
  })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    summary: {
      total_scans: totalScans,
      total_signups: totalSignups,
      total_purchases: totalPurchases,
      conversion_rate: totalScans > 0 ? (totalPurchases / totalScans * 100) : 0,
      total_commissions: totalCommissions,
      total_order_value: totalOrderValue,
      avg_order_value: totalPurchases > 0 ? (totalOrderValue / totalPurchases) : 0
    },
    recent_activity: recentActivity.slice(0, 20), // Last 20 activities
    user_type: 'partner'
  };
}

async function getCustomerAnalytics(supabase: any, userProfileId: string) {
  // Get customer's personal referral code and referred customers
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id, personal_referral_code')
    .eq('user_id', userProfileId.replace('user_profiles:', '')) // Remove prefix if needed
    .single();

  if (customerError || !customer) {
    // Customer might not have made referrals yet
    return {
      summary: {
        total_scans: 0,
        total_signups: 0,
        total_purchases: 0,
        conversion_rate: 0,
        total_rewards: 0,
        total_order_value: 0
      },
      recent_activity: [],
      user_type: 'customer'
    };
  }

  // Find customers referred by this customer using personal referral code
  const { data: referredCustomers, error: referralError } = await supabase
    .from('customers')
    .select(`
      id,
      referral_type,
      referral_applied_at,
      referral_order_id,
      referral_code_used,
      referred_order:orders!referral_order_id (
        total_amount,
        created_at,
        status
      )
    `)
    .eq('referral_type', 'CUSTOMER')
    .eq('referrer_id', userProfileId);

  const referredCustomersData = referredCustomers || [];

  // Calculate summary stats
  const totalScans = referredCustomersData.length;
  const totalSignups = referredCustomersData.length;
  const totalPurchases = referredCustomersData.filter(c => c.referred_order).length;

  // Customer rewards (typically credits rather than commissions)
  const totalRewards = totalPurchases * 5; // Example: £5 credit per successful referral

  const totalOrderValue = referredCustomersData.reduce((sum, customer) => {
    if (customer.referred_order) {
      return sum + (customer.referred_order.total_amount / 100);
    }
    return sum;
  }, 0);

  // Create privacy-protected activity log
  const recentActivity = referredCustomersData.map(customer => ({
    id: customer.id,
    type: customer.referred_order ? 'purchase' : 'signup',
    date: customer.referred_order ? customer.referred_order.created_at : customer.referral_applied_at,
    order_value: customer.referred_order ? customer.referred_order.total_amount / 100 : null,
    reward: customer.referred_order ? 5 : null, // £5 credit per purchase
  })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    summary: {
      total_scans: totalScans,
      total_signups: totalSignups,
      total_purchases: totalPurchases,
      conversion_rate: totalScans > 0 ? (totalPurchases / totalScans * 100) : 0,
      total_rewards: totalRewards,
      total_order_value: totalOrderValue,
      avg_order_value: totalPurchases > 0 ? (totalOrderValue / totalPurchases) : 0
    },
    recent_activity: recentActivity.slice(0, 20),
    user_type: 'customer'
  };
}

async function getInfluencerAnalytics(supabase: any, userProfileId: string) {
  // Get customers referred by this influencer
  const { data: referredCustomers, error } = await supabase
    .from('customers')
    .select(`
      id,
      referral_type,
      referral_applied_at,
      referral_order_id,
      referral_commission_rate,
      referred_order:orders!referral_order_id (
        total_amount,
        created_at,
        status
      )
    `)
    .eq('referral_type', 'INFLUENCER')
    .eq('referrer_id', userProfileId);

  const customers = referredCustomers || [];

  const totalScans = customers.length;
  const totalSignups = customers.length;
  const totalPurchases = customers.filter(c => c.referred_order).length;

  const totalCommissions = customers.reduce((sum, customer) => {
    if (customer.referred_order && customer.referral_commission_rate > 0) {
      const orderValue = customer.referred_order.total_amount / 100;
      const commission = orderValue * (customer.referral_commission_rate / 100);
      return sum + commission;
    }
    return sum;
  }, 0);

  const totalOrderValue = customers.reduce((sum, customer) => {
    if (customer.referred_order) {
      return sum + (customer.referred_order.total_amount / 100);
    }
    return sum;
  }, 0);

  const recentActivity = customers.map(customer => ({
    id: customer.id,
    type: customer.referred_order ? 'purchase' : 'signup',
    date: customer.referred_order ? customer.referred_order.created_at : customer.referral_applied_at,
    order_value: customer.referred_order ? customer.referred_order.total_amount / 100 : null,
    commission: customer.referred_order && customer.referral_commission_rate > 0
      ? (customer.referred_order.total_amount / 100) * (customer.referral_commission_rate / 100)
      : null,
  })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    summary: {
      total_scans: totalScans,
      total_signups: totalSignups,
      total_purchases: totalPurchases,
      conversion_rate: totalScans > 0 ? (totalPurchases / totalScans * 100) : 0,
      total_commissions: totalCommissions,
      total_order_value: totalOrderValue,
      avg_order_value: totalPurchases > 0 ? (totalOrderValue / totalPurchases) : 0
    },
    recent_activity: recentActivity.slice(0, 20),
    user_type: 'influencer'
  };
}