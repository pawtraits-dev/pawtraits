import { createHash } from 'crypto';

/**
 * Meta Conversions API (server-side) — sends Purchase (and the earlier funnel steps, CustomizeProduct and Lead) so iOS/ad-blocked conversions still
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

export interface MetaEventInput {
  name: string;                       // Meta event name, e.g. 'Purchase', 'CustomizeProduct', 'Lead'
  eventId: string;                    // must equal the browser pixel's eventID for de-duplication
  eventTimeS?: number;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  postcode?: string | null;
  country?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  sourceUrl?: string | null;
  customData?: Record<string, unknown>;
}

/** The JSON body for one Conversions API event (pure: no network, no secrets) */
export function buildMetaEvent(p: MetaEventInput) {
  return {
    data: [{
      event_name: p.name,
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
      custom_data: p.customData ?? {},
    }],
    ...(process.env.META_CAPI_TEST_EVENT_CODE ? { test_event_code: process.env.META_CAPI_TEST_EVENT_CODE } : {}),
  };
}

/** Posts one event. Never throws; a no-op without the pixel id / access token. Logs no addresses or tokens. */
export async function sendMetaEvent(p: MetaEventInput): Promise<void> {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!pixelId || !token) return;
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildMetaEvent(p)),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.warn(`Meta CAPI ${p.name} failed`, res.status, (await res.text()).slice(0, 300));
  } catch (e) {
    console.warn(`Meta CAPI ${p.name} error`, e instanceof Error ? e.message : 'unknown');
  }
}

export async function sendMetaPurchase(p: CapiPurchase): Promise<void> {
  const { valuePounds, contentIds, ...rest } = p;
  await sendMetaEvent({
    ...rest,
    name: 'Purchase',
    customData: { currency: 'GBP', value: valuePounds, content_ids: contentIds, content_type: 'product' },
  });
}
