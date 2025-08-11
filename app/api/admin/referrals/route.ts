import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    // TODO: Add admin authentication check
    
    console.log('Admin referrals API: Fetching all referrals...');
    
    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    // Get all referrals with partner and commission information
    const { data: referrals, error } = await supabase
      .from('referrals')
      .select(`
        *,
        partners (
          id,
          first_name,
          last_name,
          business_name,
          email
        ),
        client_orders (
          order_value,
          commission_amount,
          commission_paid,
          order_status,
          created_at
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching referrals:', error);
      throw error;
    }

    // Process referrals to include commission data from client_orders
    const processedReferrals = referrals?.map((referral: any) => {
      // Calculate commission statistics from client_orders
      const orders = referral.client_orders || [];
      const orderCount = orders.length;
      const totalOrderValue = orders.reduce((sum: number, order: any) => sum + (parseFloat(order.order_value) || 0), 0);
      const totalCommissionAmount = orders.reduce((sum: number, order: any) => sum + (parseFloat(order.commission_amount) || 0), 0);
      const commissionPaid = orders.some((order: any) => order.commission_paid);
      
      return {
        ...referral,
        // Remove the nested client_orders array 
        client_orders: undefined,
        // Add calculated commission data
        order_count: orderCount,
        order_value: totalOrderValue,
        total_order_value: totalOrderValue,
        commission_amount: totalCommissionAmount > 0 ? totalCommissionAmount / 100 : (referral.commission_amount ? referral.commission_amount / 100 : null),
        commission_paid: commissionPaid,
        // Partner information
        partner_name: referral.partners ? 
          `${referral.partners.first_name} ${referral.partners.last_name}`.trim() : 
          'Unknown Partner',
        partner_business: referral.partners?.business_name || 'N/A',
        partner_email: referral.partners?.email || 'N/A',
        // Expiry calculations
        is_expired: referral.expires_at ? new Date(referral.expires_at) < new Date() : false,
        days_until_expiry: referral.expires_at ? Math.ceil((new Date(referral.expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0
      };
    }) || [];

    console.log('Admin referrals API: Found', processedReferrals.length, 'referrals');
    return NextResponse.json(processedReferrals);
  } catch (error) {
    console.error('Error fetching referrals for admin:', error);
    return NextResponse.json(
      { error: 'Failed to fetch referrals' },
      { status: 500 }
    );
  }
}