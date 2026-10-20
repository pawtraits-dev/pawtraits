import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';
import { getRequester, canAccessCustomImage } from '@/lib/guest/access';
import { wrapMockups } from '@/lib/mugs/mockup';
import { watermarkTiles } from '@/lib/watermark';

export const dynamic = 'force-dynamic';

/**
 * GET /api/customers/custom-images/[id]
 * Status/result of a customised portrait. Works for signed-in customers (by email)
 * and for guests on the device that created it (pt_vid cookie).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const requester = await getRequester(request);
    if (!requester.user && !requester.guestId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { data: customImage, error } = await serviceClient()
      .from('customer_custom_images')
      .select('id, customer_email, guest_session_id, catalog_image_id, pet_name, generated_image_url, generated_cloudinary_id, share_token, status, error_message, created_at, generated_at, rating')
      .eq('id', id)
      .maybeSingle();

    // 404 (not 403) for someone else's image, so ids can't be probed
    if (error || !customImage || !canAccessCustomImage(customImage, requester)) {
      return NextResponse.json({ error: 'Custom image not found' }, { status: 404 });
    }

    const { guest_session_id: _g, customer_email: _e, generated_cloudinary_id: gen, ...safe } = customImage as any;
    // Wraparound (2:1) designs: the finished painting on the mug photos (watermarked, like the preview)
    let mugMockups = {};
    if (customImage.status === 'complete' && gen && customImage.catalog_image_id) {
      const { data: design } = await serviceClient().from('image_catalog').select('formats:format_id (aspect_ratio)').eq('id', customImage.catalog_image_id).maybeSingle();
      const f: any = (design as any)?.formats;
      if ((Array.isArray(f) ? f[0] : f)?.aspect_ratio === '2:1') mugMockups = await wrapMockups(gen, { extra: watermarkTiles() }).catch(() => ({}));
    }
    return NextResponse.json({ ...safe, mugMockups }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('custom-image GET failed', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
