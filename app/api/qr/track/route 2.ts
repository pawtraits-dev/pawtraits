import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { imageId, partnerId, userAgent, referer } = await request.json();

    if (!imageId) {
      return NextResponse.json(
        { error: 'Image ID is required' },
        { status: 400 }
      );
    }

    console.log(`🔲 QR scan tracked: Image ${imageId}, Partner ${partnerId || 'none'}`);

    // Use the database function to increment scan count
    const { error } = await supabase.rpc('increment_qr_scan', {
      p_image_id: imageId,
      p_partner_id: partnerId || null
    });

    if (error) {
      console.error('❌ QR tracking error:', error);
      throw error;
    }

    // Optionally store additional tracking data
    if (userAgent || referer) {
      const { error: detailError } = await supabase
        .from('qr_code_tracking')
        .update({
          qr_code_data: supabase.raw(`
            qr_code_data || '{"tracking": {"user_agent": "${userAgent || ''}", "referer": "${referer || ''}"}}'
          `),
          updated_at: new Date().toISOString()
        })
        .eq('image_id', imageId)
        .eq('partner_id', partnerId || null);

      if (detailError) {
        console.warn('⚠️ Failed to update tracking details:', detailError);
      }
    }

    console.log('✅ QR scan tracked successfully');
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('❌ QR tracking failed:', error);
    return NextResponse.json(
      { error: 'Failed to track QR scan' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve QR tracking statistics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get('imageId');
    const partnerId = searchParams.get('partnerId');

    let query = supabase
      .from('qr_code_tracking')
      .select(`
        *,
        image_catalog (
          filename,
          breed_name,
          theme_name
        )
      `);

    if (imageId) {
      query = query.eq('image_id', imageId);
    }

    if (partnerId) {
      query = query.eq('partner_id', partnerId);
    }

    const { data: trackingData, error } = await query.order('scan_count', { ascending: false });

    if (error) {
      throw error;
    }

    // Calculate summary statistics
    const summary = {
      total_scans: trackingData?.reduce((sum, record) => sum + (record.scan_count || 0), 0) || 0,
      unique_images: new Set(trackingData?.map(record => record.image_id)).size,
      unique_partners: new Set(trackingData?.map(record => record.partner_id).filter(Boolean)).size,
      tracking_records: trackingData?.length || 0
    };

    return NextResponse.json({
      summary,
      tracking_data: trackingData
    });

  } catch (error) {
    console.error('❌ QR tracking retrieval failed:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve QR tracking data' },
      { status: 500 }
    );
  }
}