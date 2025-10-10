import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    // Use service role key for public QR code access
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { code } = await params;

    if (!code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    // Look up referral code - check partners first, then customers
    let codeData = null;
    let referrerType = null;

    // Check if code belongs to a partner
    const { data: partnerData, error: partnerError } = await supabase
      .from('partners')
      .select('id, business_name, first_name, last_name, email, personal_referral_code, is_active, approval_status, logo_url')
      .eq('personal_referral_code', code)
      .single();

    if (partnerData && partnerData.is_active && partnerData.approval_status === 'approved') {
      referrerType = 'partner';
      codeData = {
        id: partnerData.id,
        code: partnerData.personal_referral_code,
        status: 'active',
        partner_id: partnerData.id,
        partner: {
          id: partnerData.id,
          business_name: partnerData.business_name,
          first_name: partnerData.first_name,
          last_name: partnerData.last_name,
          email: partnerData.email,
          logo_url: partnerData.logo_url
        },
        share_url: `/c/${partnerData.personal_referral_code}`,
        scans_count: 0,
        referrer_type: 'partner'
      };

      // Increment partner scan count
      const { error: incrementError } = await supabase.rpc('increment_partner_referral_scans', {
        p_partner_id: partnerData.id
      });

      if (incrementError) {
        console.error('Failed to increment partner scan count:', incrementError);
        // Continue anyway - this is not critical
      }
    } else {
      // Look up customer by personal_referral_code
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('id, first_name, last_name, email, personal_referral_code, is_registered')
        .eq('personal_referral_code', code)
        .single();

      if (customerData && customerData.is_registered) {
        referrerType = 'customer';
        codeData = {
          id: customerData.id,
          code: customerData.personal_referral_code,
          status: 'active',
          customer_id: customerData.id,
          customer: {
            id: customerData.id,
            first_name: customerData.first_name,
            last_name: customerData.last_name,
            email: customerData.email
          },
          share_url: `/c/${customerData.personal_referral_code}`,
          scans_count: 0,
          referrer_type: 'customer'
        };

        // Increment customer scan count
        const { error: incrementError } = await supabase.rpc('increment_customer_referral_scans', {
          p_customer_id: customerData.id
        });

        if (incrementError) {
          console.error('Failed to increment customer scan count:', incrementError);
          // Continue anyway - this is not critical
        }
      }
    }

    if (!codeData) {
      return NextResponse.json({ error: 'Code not found' }, { status: 404 });
    }

    return NextResponse.json(codeData);
  } catch (error) {
    console.error('Customer referral code verification error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
