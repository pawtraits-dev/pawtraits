import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';
import { generateReferralQR } from '@/lib/qr-code';

const supabaseService = new SupabaseService();

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    const body = await request.json();
    const { upload = false, branded = false } = body;

    // Get the referral
    const referral = await supabaseService.getReferral(params.id);
    
    if (!referral) {
      return NextResponse.json(
        { error: 'Referral not found' },
        { status: 404 }
      );
    }

    // Get partner info for branded QR codes
    let partnerName = '';
    if (branded) {
      const partner = await supabaseService.getPartner(referral.partner_id);
      partnerName = partner?.business_name || `${partner?.first_name} ${partner?.last_name}` || '';
    }

    // Generate QR code
    const qrResult = await generateReferralQR(referral.referral_code, {
      upload,
      branded,
      partnerName
    });

    if (qrResult.error) {
      return NextResponse.json(
        { error: qrResult.error },
        { status: 500 }
      );
    }

    // If uploading, update the referral with the new QR code URL
    if (upload && qrResult.qrCodeUrl) {
      await supabaseService.updateReferral(referral.id, {
        qr_code_url: qrResult.qrCodeUrl
      });
    }

    return NextResponse.json({
      referral_code: referral.referral_code,
      qr_code_url: qrResult.qrCodeUrl,
      qr_data_url: qrResult.qrDataURL
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    return NextResponse.json(
      { error: 'Failed to generate QR code' },
      { status: 500 }
    );
  }
}