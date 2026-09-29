/**
 * Sticker QR short link resolver: /s/1123, /s/1123M, /s/1123M/CAMDEN
 * (upper-case /S/... is rewritten here by middleware).
 *
 * Records the scan, sets the signed attribution cookie, then redirects to the
 * customise page with the image pre-selected. Never fails the customer: any error
 * still ends in a redirect. Spec: docs/specs/qr-stickers.md §3
 */
import { NextRequest, NextResponse } from 'next/server';
import { parseStickerSegments } from '@/lib/qr/sticker-url';
import {
  QR_ATTRIBUTION_COOKIE, VISITOR_COOKIE, ATTRIBUTION_MAX_AGE_S, VISITOR_MAX_AGE_S,
  encodeAttribution, validVisitorId, newVisitorId, hashIp, isBotUserAgent,
} from '@/lib/qr/attribution';
import { serviceClient } from '@/lib/qr/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const REPEAT_WINDOW_MS = 30 * 60 * 1000;

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const parsed = parseStickerSegments(slug ?? [], request.nextUrl.searchParams.get('l'));

  if (!parsed) {
    return noStore(NextResponse.redirect(new URL('/browse?src=qr&invalid=1', request.url), 302));
  }

  const ua = request.headers.get('user-agent');
  const isBot = isBotUserAgent(ua);
  const existingVisitor = validVisitorId(request.cookies.get(VISITOR_COOKIE)?.value);
  const visitorId = existingVisitor ?? newVisitorId();

  let imageId: string | null = null;
  let locationId: string | null = null;
  let scanId: string | null = null;

  try {
    const supabase = serviceClient();

    const [imageRes, locationRes] = await Promise.all([
      supabase.from('image_catalog').select('id, is_public').eq('stock_ref', parsed.stockRef).maybeSingle(),
      parsed.locationCode
        ? supabase.from('stock_locations').select('id').eq('code', parsed.locationCode).eq('is_active', true).maybeSingle()
        : Promise.resolve({ data: null, error: null } as const),
    ]);

    if (imageRes.error) console.error('QR scan: image lookup failed', imageRes.error);
    if (locationRes.error) console.error('QR scan: location lookup failed', locationRes.error);

    if (imageRes.data && imageRes.data.is_public !== false) imageId = imageRes.data.id;
    locationId = (locationRes.data as { id: string } | null)?.id ?? null;

    let isRepeat = false;
    if (existingVisitor && !isBot) {
      const { data: recent } = await supabase
        .from('qr_scans')
        .select('id')
        .eq('visitor_id', existingVisitor)
        .eq('stock_ref', parsed.stockRef)
        .gte('created_at', new Date(Date.now() - REPEAT_WINDOW_MS).toISOString())
        .limit(1);
      isRepeat = !!recent?.length;
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip');

    const { data: scan, error: scanError } = await supabase
      .from('qr_scans')
      .insert({
        image_id: imageId,
        stock_ref: parsed.stockRef,
        size_code: parsed.size,
        location_id: locationId,
        location_code: parsed.locationCode,
        visitor_id: visitorId,
        is_repeat: isRepeat,
        is_bot: isBot,
        user_agent: ua?.slice(0, 500) ?? null,
        referer: request.headers.get('referer')?.slice(0, 500) ?? null,
        ip_hash: hashIp(ip),
      })
      .select('id')
      .single();

    if (scanError) console.error('QR scan: insert failed', scanError);
    scanId = scan?.id ?? null;
  } catch (error) {
    console.error('QR scan: unexpected error', error);
  }

  // Build destination
  let dest: URL;
  if (imageId) {
    dest = new URL(`/customise/${imageId}`, request.url);
    dest.searchParams.set('src', 'qr');
    if (parsed.size) dest.searchParams.set('size', parsed.size);
    dest.searchParams.set('utm_source', 'stall');
    dest.searchParams.set('utm_medium', 'qr');
    dest.searchParams.set('utm_campaign', parsed.locationCode ?? 'none');
  } else {
    dest = new URL('/browse', request.url);
    dest.searchParams.set('src', 'qr');
    dest.searchParams.set('missing', String(parsed.stockRef));
  }

  const response = noStore(NextResponse.redirect(dest, 302));
  const secure = process.env.NODE_ENV === 'production';

  if (!existingVisitor) {
    response.cookies.set(VISITOR_COOKIE, visitorId, {
      httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: VISITOR_MAX_AGE_S,
    });
  }

  // Last scan wins; link previewers never overwrite a real customer's attribution
  if (scanId && !isBot) {
    response.cookies.set(
      QR_ATTRIBUTION_COOKIE,
      encodeAttribution({ scanId, imageId, locationId, size: parsed.size, ts: Date.now() }),
      { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: ATTRIBUTION_MAX_AGE_S }
    );
  }

  return response;
}

function noStore(res: NextResponse): NextResponse {
  res.headers.set('Cache-Control', 'no-store, max-age=0');
  return res;
}
