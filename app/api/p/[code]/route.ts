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

    // Get the pre-registration code with partner information
    let codeData = null;
    let isOrganicPartnerCode = false;

    const { data: preRegData, error: preRegError } = await supabase
      .from('pre_registration_codes')
      .select(`
        *,
        partner:partners(
          id,
          business_name,
          first_name,
          last_name,
          logo_url
        )
      `)
      .eq('code', code)
      .maybeSingle();

    if (preRegData) {
      codeData = preRegData;
    } else {
      // If not found in pre_registration_codes, check partners.personal_referral_code
      const { data: partnerData, error: partnerError } = await supabase
        .from('partners')
        .select('id, business_name, first_name, last_name, logo_url, personal_referral_code, is_active, approval_status')
        .eq('personal_referral_code', code)
        .single();

      if (partnerData) {
        // Found organic partner code - construct compatible format
        isOrganicPartnerCode = true;
        codeData = {
          id: partnerData.id,
          code: partnerData.personal_referral_code,
          status: partnerData.is_active && partnerData.approval_status === 'approved' ? 'active' : 'inactive',
          partner_id: partnerData.id,
          partner: {
            id: partnerData.id,
            business_name: partnerData.business_name,
            first_name: partnerData.first_name,
            last_name: partnerData.last_name,
            logo_url: partnerData.logo_url
          },
          scans_count: 0,
          expiration_date: null
        };
      }
    }

    if (!codeData) {
      return NextResponse.json({ error: 'Code not found' }, { status: 404 });
    }

    // Check if code is active
    if (codeData.status !== 'active') {
      if (codeData.status === 'expired') {
        return NextResponse.json({ error: 'Code has expired' }, { status: 410 });
      } else if (codeData.status === 'used') {
        // If code is used, redirect to customer signup with partner referral
        // Get partner email by joining with partners table
        const { data: partnerData } = await supabase
          .from('partners')
          .select('email')
          .eq('id', codeData.partner_id)
          .single();

        return NextResponse.json({
          redirect: 'customer_invitation',
          partner_id: codeData.partner_id,
          partner_email: partnerData?.email,
          code: codeData.code
        }, { status: 200 });
      }
      return NextResponse.json({ error: 'Code is not active' }, { status: 410 });
    }

    // Check if code has expired
    if (codeData.expiration_date && new Date(codeData.expiration_date) < new Date()) {
      return NextResponse.json({ error: 'Code has expired' }, { status: 410 });
    }

    // Increment scan count atomically using RPC function
    // Only for pre-registration codes (not organic partner codes)
    if (!isOrganicPartnerCode) {
      const { error: incrementError } = await supabase.rpc('increment_prereg_scan_count', {
        p_code_id: codeData.id
      });

      if (incrementError) {
        console.error('Failed to increment scan count:', incrementError);
        // Continue anyway - this is not critical
      }
    }

    return NextResponse.json(codeData);
  } catch (error) {
    console.error('Pre-registration code verification error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}