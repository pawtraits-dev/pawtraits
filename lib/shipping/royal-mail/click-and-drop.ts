/**
 * Royal Mail Click & Drop API client (server only).
 * Spec: https://api.parcel.royalmail.com/doc/v1/click-and-drop-api-v1.yaml
 *
 *   Auth   Authorization: Bearer <CLICK_AND_DROP_API_KEY>   (Click & Drop → Settings → Integrations → API)
 *   Limit  5 calls a second (429 beyond)
 *   Labels GET /orders/{ids}/label is "Reserved for OBA customers only" (Online Business Account)
 */
const BASE = (process.env.CLICK_AND_DROP_API_BASE || 'https://api.parcel.royalmail.com/api/v1').replace(/\/$/, '');

export class ClickAndDropError extends Error {
  constructor(message: string, public status = 500, public details?: unknown) { super(message); }
}

export const clickAndDropConfigured = () => !!process.env.CLICK_AND_DROP_API_KEY;

async function call(path: string, init: RequestInit = {}, accept = 'application/json'): Promise<Response> {
  const key = process.env.CLICK_AND_DROP_API_KEY;
  if (!key) throw new ClickAndDropError('Royal Mail isn\'t connected: set CLICK_AND_DROP_API_KEY (Click & Drop → Settings → Integrations → API).', 503);
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${key}`, Accept: accept, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers || {}) },
      signal: AbortSignal.timeout(30_000),
      cache: 'no-store',
    });
    if (res.status === 429 && attempt < 3) { await new Promise(r => setTimeout(r, 1200 * (attempt + 1))); continue; }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let msg = text.slice(0, 400);
      try { const j = JSON.parse(text); msg = j.message || j.title || j.errors?.map?.((e: any) => e.errorMessage || e.message).join('; ') || msg; } catch { /* not JSON */ }
      if (res.status === 401) msg = 'Royal Mail rejected the API key (check CLICK_AND_DROP_API_KEY)';
      if (res.status === 403) msg = `Royal Mail: ${msg || 'not allowed'} (labels through the API need an Online Business Account)`;
      throw new ClickAndDropError(`Click & Drop ${res.status}: ${msg}`, res.status, text);
    }
    return res;
  }
}

export interface CDAddress { fullName?: string; companyName?: string; addressLine1: string; addressLine2?: string; addressLine3?: string; city: string; county?: string; postcode?: string; countryCode: string }
export interface CDContent { name: string; SKU?: string; quantity: number; unitValue: number; unitWeightInGrams: number; customsDescription?: string; customsCode?: string; originCountryCode?: string }
export interface CDPackage { weightInGrams: number; packageFormatIdentifier: 'letter' | 'largeLetter' | 'smallParcel' | 'mediumParcel' | 'largeParcel' | 'parcel'; contents?: CDContent[] }
export interface CDCreateOrder {
  orderReference: string;
  recipient: { address: CDAddress; phoneNumber?: string; emailAddress?: string };
  orderDate: string; subtotal: number; shippingCostCharged: number; total: number; currencyCode?: string;
  packages: CDPackage[];
  postageDetails?: { serviceCode?: string; sendNotificationsTo?: 'sender' | 'recipient' | 'billing'; receiveEmailNotification?: boolean; receiveSmsNotification?: boolean };
  label?: { includeLabelInResponse: boolean; includeCN?: boolean; includeReturnsLabel?: boolean };
}
export interface CDCreated { orderIdentifier: number; orderReference?: string; trackingNumber?: string; label?: string; createdOn?: string }
export interface CDFailed { orderReference?: string; errors: string[] }

/** Create orders (up to 100). Created and failed are both returned; nothing throws for a bad address. */
export async function createOrders(items: CDCreateOrder[]): Promise<{ created: CDCreated[]; failed: CDFailed[] }> {
  if (!items.length) return { created: [], failed: [] };
  const res = await call('/orders', { method: 'POST', body: JSON.stringify({ items }) });
  const j: any = await res.json().catch(() => ({}));
  const created: CDCreated[] = (j.createdOrders ?? []).map((o: any) => ({
    orderIdentifier: Number(o.orderIdentifier), orderReference: o.orderReference, createdOn: o.createdOn,
    trackingNumber: o.trackingNumber || o.packages?.[0]?.trackingNumber || undefined, label: o.label || undefined,
  }));
  const failed: CDFailed[] = (j.failedOrders ?? []).map((f: any) => ({
    orderReference: f.order?.orderReference ?? f.orderReference,
    errors: (f.errors ?? []).map((e: any) => [e.errorMessage || e.message, e.fields?.map?.((x: any) => x.fieldName).join(', ')].filter(Boolean).join(' — ')),
  }));
  return { created, failed };
}

/** Postage labels for orders (one PDF, customs forms included for overseas): OBA accounts */
export async function getLabels(orderIdentifiers: number[]): Promise<Uint8Array> {
  const ids = orderIdentifiers.join(';');
  const res = await call(`/orders/${encodeURIComponent(ids)}/label?documentType=postageLabel&includeReturnsLabel=false&includeCN=true`, {}, 'application/pdf');
  return new Uint8Array(await res.arrayBuffer());
}

/** Orders as Click & Drop has them (tracking numbers appear once the label is made) */
export async function getOrders(orderIdentifiers: number[]): Promise<{ orderIdentifier: number; orderReference?: string; trackingNumber?: string; shippedOn?: string; labelPrintedOn?: string }[]> {
  if (!orderIdentifiers.length) return [];
  const res = await call(`/orders/${encodeURIComponent(orderIdentifiers.join(';'))}`);
  const j: any = await res.json().catch(() => []);
  return (Array.isArray(j) ? j : j.orders ?? []).map((o: any) => ({
    orderIdentifier: Number(o.orderIdentifier), orderReference: o.orderReference,
    trackingNumber: o.trackingNumber || o.packages?.[0]?.trackingNumber || undefined,
    shippedOn: o.shippedOn, labelPrintedOn: o.labelPrintedOn,
  }));
}

/** Quick check that the key works (lists one recent order) */
export async function ping(): Promise<void> {
  await call('/orders?pageSize=1');
}
