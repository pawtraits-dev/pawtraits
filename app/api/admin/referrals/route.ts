import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    // TODO: Add admin authentication check
    
    console.log('Admin referrals API: Fetching referrals using simplified system...');
    
    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    // Get all customers with referral data using simplified system
    const { data: customers, error } = await supabase
      .from('customers')
      .select(`
        id,
        email,
        first_name,
        last_name,
        referral_type,
        referrer_id,
        referral_code_used,
        referral_discount_applied,
        referral_commission_rate,
        referral_applied_at,
        referral_order_id,
        created_at,
        referrer:user_profiles!referrer_id (
          id,
          first_name,
          last_name,
          email,
          user_type,
          partner_id,
          customer_id,
          partner:partners (
            id,
            business_name
          ),
          customer:customers (
            id,
            first_name,
            last_name
          )
        ),
        referred_order:orders!referral_order_id (
          id,
          order_number,
          total_amount,
          currency,
          created_at,
          status
        )
      `)
      .not('referral_type', 'eq', 'ORGANIC')
      .not('referral_type', 'is', null)
      .order('referral_applied_at', { ascending: false });

    if (error) {
      console.error('Error fetching simplified referrals:', error);
      throw error;
    }

    // Process customers to format as referral records
    const processedReferrals = customers?.map((customer: any) => {
      const referrer = customer.referrer;
      let referrerName = 'Unknown Referrer';
      let referrerBusiness = 'N/A';
      let referrerEmail = 'N/A';

      if (referrer) {
        if (customer.referral_type === 'PARTNER' && referrer.partner) {
          referrerName = referrer.partner.business_name || `${referrer.first_name} ${referrer.last_name}`.trim();
          referrerBusiness = referrer.partner.business_name || 'N/A';
          referrerEmail = referrer.email || 'N/A';
        } else if (customer.referral_type === 'CUSTOMER' && referrer.customer) {
          referrerName = `${referrer.customer.first_name} ${referrer.customer.last_name}`.trim();
          referrerBusiness = 'Customer Referral';
          referrerEmail = referrer.email || 'N/A';
        } else if (customer.referral_type === 'INFLUENCER') {
          referrerName = `${referrer.first_name} ${referrer.last_name}`.trim();
          referrerBusiness = 'Influencer';
          referrerEmail = referrer.email || 'N/A';
        }
      }

      // Determine status based on referral completion
      let status = 'pending';
      if (customer.referred_order) {
        status = 'purchased';
      } else if (customer.referral_applied_at) {
        status = 'viewed';
      }

      return {
        id: customer.id,
        referral_code: customer.referral_code_used || 'N/A',
        client_name: `${customer.first_name} ${customer.last_name}`.trim(),
        client_email: customer.email,
        client_phone: null, // Not stored in simplified system
        status: status,
        commission_amount: customer.referred_order ?
          (customer.referred_order.total_amount * (customer.referral_commission_rate || 0) / 100 / 100) : null, // Convert from pence to pounds
        commission_rate: customer.referral_commission_rate || 0,
        commission_paid: false, // TODO: Implement commission payment tracking
        qr_scans: 0, // Not tracked in simplified system
        email_opens: 0, // Not tracked in simplified system
        expires_at: null, // No expiry in simplified system
        created_at: customer.created_at,
        purchased_at: customer.referred_order?.created_at || null,
        last_viewed_at: customer.referral_applied_at,
        partner_name: referrerName,
        partner_business: referrerBusiness,
        partner_email: referrerEmail,
        is_expired: false, // No expiry in simplified system
        days_until_expiry: 0,
        // Additional fields for simplified system
        referral_type: customer.referral_type,
        referrer_id: customer.referrer_id,
        discount_applied: customer.referral_discount_applied ? customer.referral_discount_applied / 100 : 0, // Convert pence to pounds
        order_value: customer.referred_order?.total_amount ? customer.referred_order.total_amount / 100 : 0 // Convert pence to pounds
      };
    }) || [];

    // Calculate summary analytics for admin dashboard
    const summaryAnalytics = {
      total_referrals: processedReferrals.length,
      by_type: {
        PARTNER: processedReferrals.filter(r => r.referral_type === 'PARTNER').length,
        CUSTOMER: processedReferrals.filter(r => r.referral_type === 'CUSTOMER').length,
        INFLUENCER: processedReferrals.filter(r => r.referral_type === 'INFLUENCER').length,
      },
      by_status: {
        pending: processedReferrals.filter(r => r.status === 'pending').length,
        viewed: processedReferrals.filter(r => r.status === 'viewed').length,
        purchased: processedReferrals.filter(r => r.status === 'purchased').length,
      },
      total_commission: processedReferrals.reduce((sum, r) => sum + (r.commission_amount || 0), 0),
      total_order_value: processedReferrals.reduce((sum, r) => sum + (r.order_value || 0), 0),
      conversion_rate: processedReferrals.length > 0
        ? (processedReferrals.filter(r => r.status === 'purchased').length / processedReferrals.length * 100)
        : 0
    };

    console.log('Admin referrals API: Found', processedReferrals.length, 'referrals');

    return NextResponse.json({
      referrals: processedReferrals,
      analytics: summaryAnalytics
    });
  } catch (error) {
    console.error('Error fetching referrals for admin:', error);
    return NextResponse.json(
      { error: 'Failed to fetch referrals' },
      { status: 500 }
    );
  }
}