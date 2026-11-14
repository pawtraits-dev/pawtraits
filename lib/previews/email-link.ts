/**
 * "Email me this preview": the pure parts (server only; no database). The signed link carries the
 * request id and an expiry, never the address. See lib/previews/server.ts for the database parts.
 */
import { createHmac, timingSafeEqual } from 'crypto';
import { ATTRIBUTION_MAX_AGE_S, type QrAttribution } from '@/lib/qr/attribution';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const LINK_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** What one visitor can ask for (the endpoint sends email to an address an anonymous person typed) */
export const PREVIEW_LIMITS = { perPreview: 3, addressesPerGuestPerDay: 3, perAddressPerDay: 5 } as const;

function secret() {
  return process.env.PREVIEW_LINK_SECRET || process.env.SOCIAL_LINK_SECRET || process.env.DOWNLOAD_LINK_SECRET || process.env.QR_ATTRIBUTION_SECRET
    || `preview-${process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-16) ?? 'dev'}`;
}
const sig = (requestId: string, exp: string) => createHmac('sha256', secret()).update(`preview-link:${requestId}:${exp}`).digest('base64url').slice(0, 32);

/** `<request id>.<expiry, base36 ms>.<signature>` */
export function signPreviewToken(requestId: string, now = Date.now()): string {
  const exp = (now + LINK_DAYS * DAY_MS).toString(36);
  return `${requestId}.${exp}.${sig(requestId, exp)}`;
}

export type TokenCheck = { ok: true; requestId: string } | { ok: false; reason: 'bad' | 'expired' };

export function verifyPreviewToken(token: unknown, now = Date.now()): TokenCheck {
  if (typeof token !== 'string') return { ok: false, reason: 'bad' };
  const [id, exp, s] = token.split('.');
  if (!id || !exp || !s || !UUID_RE.test(id) || !/^[0-9a-z]+$/.test(exp)) return { ok: false, reason: 'bad' };
  const a = Buffer.from(sig(id, exp)), b = Buffer.from(s);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'bad' };
  return parseInt(exp, 36) < now ? { ok: false, reason: 'expired' } : { ok: true, requestId: id };
}

export const previewUrl = (baseUrl: string, requestId: string, now = Date.now()) => `${baseUrl.replace(/\/$/, '')}/p/${signPreviewToken(requestId, now)}`;

/** The pet's first name for an email: the first word, letters only, ≤16; null when nothing is left */
export function previewFirstName(petName: unknown): string | null {
  const word = String(petName ?? '').trim().split(/\s+/)[0] ?? '';
  const letters = Array.from(word).filter(c => c.toLowerCase() !== c.toUpperCase()).join('').slice(0, 16);
  return letters ? letters.charAt(0).toUpperCase() + letters.slice(1) : null;
}

export type LimitProblem = 'preview' | 'addresses' | 'address' | null;

/**
 * Pure limits check. `sendsForPreview`: emails already sent for this preview (any address);
 * `guestAddressesToday`: the different addresses this visitor has used in the last 24 hours (lower-cased);
 * `sendsToAddressToday`: emails to this address from anywhere on the site in the last 24 hours.
 */
export function limitProblem(i: { email: string; sendsForPreview: number; guestAddressesToday: string[]; sendsToAddressToday: number }): LimitProblem {
  if (i.sendsForPreview >= PREVIEW_LIMITS.perPreview) return 'preview';
  if (!i.guestAddressesToday.includes(i.email) && i.guestAddressesToday.length >= PREVIEW_LIMITS.addressesPerGuestPerDay) return 'addresses';
  if (i.sendsToAddressToday >= PREVIEW_LIMITS.perAddressPerDay) return 'address';
  return null;
}

/** How many of these ISO times fall in the 24 hours up to `now` */
export const sendsInLastDay = (times: unknown, now = Date.now()) => (Array.isArray(times) ? times : []).filter(t => { const ms = Date.parse(String(t)); return ms > now - DAY_MS && ms <= now + 60_000; }).length;

/** Keep the last 10 send times (more than the daily limit needs) */
export const appendSend = (times: unknown, now = Date.now()) => [...(Array.isArray(times) ? times : []), new Date(now).toISOString()].slice(-10);

export type MarketingStep = 'none' | 'subscribe' | 'already' | 'blocked_unsubscribed';

/**
 * What opening the link does about the marketing box. Only a ticked, not yet confirmed request
 * does anything. An address that has UNSUBSCRIBED stays unsubscribed: this tick was typed by an
 * anonymous visitor and only confirmed by opening a link, which is weaker than the person
 * themselves using the preferences page or "Yes please", so it never overrides an unsubscribe.
 */
export function marketingStep(req: { marketing_ticked: boolean; marketing_confirmed_at: string | null }, prefStatus: 'subscribed' | 'unsubscribed' | null): MarketingStep {
  if (!req.marketing_ticked || req.marketing_confirmed_at) return 'none';
  if (prefStatus === 'unsubscribed') return 'blocked_unsubscribed';
  if (prefStatus === 'subscribed') return 'already';
  return 'subscribe';
}

/**
 * Stall attribution to carry to the device that opens the link: the stored scan, only when this
 * device has none (or an older one) and the original 30 days have not run out. Never extends the window:
 * the timestamp stays the original one, and maxAge is what is left.
 */
export function attributionToRestore(stored: QrAttribution | null | undefined, current: QrAttribution | null | undefined, now = Date.now()): { attribution: QrAttribution; maxAgeS: number } | null {
  if (!stored?.scanId || typeof stored.ts !== 'number') return null;
  const left = Math.floor((stored.ts + ATTRIBUTION_MAX_AGE_S * 1000 - now) / 1000);
  if (left <= 0) return null;
  if (current && current.ts >= stored.ts) return null;
  return { attribution: stored, maxAgeS: left };
}
