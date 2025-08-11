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
    
    // First get referral with partner details
    const { data, error } = await supabaseService['supabase']
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

    if (error || !data) {
      return NextResponse.json(
        { error: 'Referral not found' },
        { status: 404 }
      );
    }

    // Check if expired
    if (new Date(data.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Referral has expired' },
        { status: 410 } // Gone
      );
    }

    // Debug: Log raw data from database
    console.log('Raw referral data from DB:', JSON.stringify(data, null, 2));
    console.log('Pet fields from DB:', {
      pet_name: data.pet_name,
      pet_breed_id: data.pet_breed_id,
      pet_coat_id: data.pet_coat_id
    });

    // Get image data if this is a Method 2 referral
    let imageData = null;
    if (data.image_id) {
      const { data: image, error: imageError } = await supabaseService['supabase']
        .from('image_catalog')
        .select(`
          id,
          filename,
          description,
          public_url,
          breed_name,
          theme_name,
          style_name
        `)
        .eq('id', data.image_id)
        .single();
      
      if (!imageError && image) {
        imageData = image;
      }
    }

    // Mark referral as accessed
    try {
      await supabaseService['supabase'].rpc('mark_referral_accessed', {
        p_referral_code: referralCode
      });
    } catch (accessError) {
      console.error('Error marking referral as accessed:', accessError);
      // Don't fail the request if this fails
    }

    // Format response
    const response = {
      id: data.id,
      referral_code: data.referral_code,
      client_name: data.client_first_name && data.client_last_name 
        ? `${data.client_first_name} ${data.client_last_name}`.trim() 
        : '', // Backwards compatibility
      client_first_name: data.client_first_name,
      client_last_name: data.client_last_name,
      client_email: data.client_email,
      client_phone: data.client_phone,
      pet_name: data.pet_name,
      pet_breed_id: data.pet_breed_id,
      pet_coat_id: data.pet_coat_id,
      status: data.status,
      commission_rate: data.commission_rate,
      expires_at: data.expires_at,
      referral_type: data.referral_type,
      image_id: data.image_id,
      partner: data.partners,
      image: imageData // Include image data for Method 2 referrals
    };

    console.log('Formatted response:', JSON.stringify(response, null, 2));
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching referral by code:', error);
    return NextResponse.json(
      { error: 'Failed to fetch referral' },
      { status: 500 }
    );
  }
}