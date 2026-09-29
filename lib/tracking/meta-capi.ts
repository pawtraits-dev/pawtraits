import { createHash } from 'crypto';

/**
 * Meta Conversions API (server-side) — sends Purchase so iOS/ad-blocked conversions still
 * count. Only called when the buyer gave marketing consent. De-duplicated against the
 * browser Pixel via event_id (the Stripe PaymentIntent id).
 */
const sha256 = (v?: string | null) => (v ? createHash('sha256').update(v.trim().toLowerCase()).digest('hex') : undefined);

export interface CapiPurchase {
  eventId: string;
  eventTimeS?: number;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  postcode?: string | null;
  country?: string | null; // ISO-2, e.g. "gb"
  valuePounds: number;
  contentIds: string[];
  fbp?: string | null;
  fbc?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  sourceUrl?: string | null;
}

export async function sendMetaPurchase(p: CapiPurchase): Promise<void> {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!pixelId || !token) return;

  const body = {
    data: [{
      event_name: 'Purchase',
      event_time: p.eventTimeS ?? Math.floor(Date.now() / 1000),
      event_id: p.eventId,
      action_source: 'website',
      event_source_url: p.sourceUrl ?? undefined,
      user_data: {
        em: sha256(p.email) ? [sha256(p.email)] : undefined,
        ph: p.phone ? [sha256(p.phone.replace(/[^0-9]/g, ''))] : undefined,
        fn: sha256(p.firstName) ? [sha256(p.firstName)] : undefined,
        ln: sha256(p.lastName) ? [sha256(p.lastName)] : undefined,
        zp: p.postcode ? [sha256(p.postcode.replace(/\s/g, ''))] : undefined,
        country: p.country ? [sha256(p.country)] : undefined,
        fbp: p.fbp ?? undefined,
        fbc: p.fbc ?? undefined,
        client_ip_address: p.clientIp ?? undefined,
        client_user_agent: p.userAgent ?? undefined,
      },
      custom_data: { currency: 'GBP', value: p.valuePounds, content_ids: p.contentIds, content_type: 'product' },
    }],
    ...(process.env.META_CAPI_TEST_EVENT_CODE ? { test_event_code: process.env.META_CAPI_TEST_EVENT_CODE } : {}),
  };

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.warn('Meta CAPI Purchase failed', res.status, (await res.text()).slice(0, 300));
  } catch (e) {
    console.warn('Meta CAPI Purchase error', e);
  }
}
