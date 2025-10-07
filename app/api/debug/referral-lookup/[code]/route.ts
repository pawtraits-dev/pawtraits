import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';

const supabaseService = new SupabaseService();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const referralCode = code.toUpperCase();
    
    console.log('DEBUG: Looking up referral code:', referralCode);
    
    // First, try basic lookup without joins
    const { data: basicData, error: basicError } = await supabaseService['supabase']
      .from('referrals')
      .select('*')
      .eq('referral_code', referralCode)
      .single();

    console.log('DEBUG: Basic lookup result:', { basicData, basicError });

    // Then try with partners join
    const { data: withPartner, error: partnerError } = await supabaseService['supabase']
      .from('referrals')
      .select(`
        *,
        partners (
          first_name,
          last_name,
          business_name,
          business_type,
          avatar_url
        )
      `)
      .eq('referral_code', referralCode)
      .single();

    console.log('DEBUG: With partner join result:', { withPartner, partnerError });

    // Try with image join if image_id exists
    let withImage = null;
    let imageError = null;
    
    if (basicData?.image_id) {
      const { data: imageData, error: imgError } = await supabaseService['supabase']
        .from('referrals')
        .select(`
          *,
          partners (
            first_name,
            last_name,
            business_name,
            business_type,
            avatar_url
          ),
          image_catalog (
            id,
            filename,
            description,
            public_url,
            breed_name,
            theme_name,
            style_name
          )
        `)
        .eq('referral_code', referralCode)
        .single();
      
      withImage = imageData;
      imageError = imgError;
      console.log('DEBUG: With image join result:', { withImage, imageError });
    }

    return NextResponse.json({
      referral_code: referralCode,
      basic_lookup: { data: basicData, error: basicError },
      partner_join: { data: withPartner, error: partnerError },
      image_join: { data: withImage, error: imageError },
      debug_info: {
        has_image_id: !!basicData?.image_id,
        expires_at: basicData?.expires_at,
        is_expired: basicData?.expires_at ? new Date(basicData.expires_at) < new Date() : null
      }
    });

  } catch (error) {
    console.error('Debug lookup error:', error);
    return NextResponse.json(
      { error: 'Debug lookup failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}