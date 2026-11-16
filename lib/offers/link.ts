/**
 * The signed link in an offer email: /po/<token>. Same approach as the preview link (lib/previews/email-link.ts),
 * pure (no database). The token carries the offer id, ONE picture's id and an expiry (30 days), never an address.
 * What it grants is decided on the server (app/po/[token]/route.ts): that one picture, and only if it is one of this offer's.
 */
import { createHmac, timingSafeEqual } from 'crypto';
import { LINK_DAYS } from '@/lib/previews/email-link';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_MS = 24 * 60 * 60 * 1000;

function secret() {
  return process.env.PREVIEW_LINK_SECRET || process.env.SOCIAL_LINK_SECRET || process.env.DOWNLOAD_LINK_SECRET || process.env.QR_ATTRIBUTION_SECRET
    || `preview-${process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-16) ?? 'dev'}`;
}
// A different prefix from the preview link's, so a preview token can never be passed off as an offer token
const sig = (offerId: string, imageId: string, exp: string) => createHmac('sha256', secret()).update(`offer-link:${offerId}:${imageId}:${exp}`).digest('base64url').slice(0, 32);

/** `<offer id>.<picture id>.<expiry, base36 ms>.<signature>` */
export function signOfferToken(offerId: string, imageId: string, now = Date.now()): string {
  const exp = (now + LINK_DAYS * DAY_MS).toString(36);
  return `${offerId}.${imageId}.${exp}.${sig(offerId, imageId, exp)}`;
}

export type OfferTokenCheck = { ok: true; offerId: string; imageId: string } | { ok: false; reason: 'bad' | 'expired' };

export function verifyOfferToken(token: unknown, now = Date.now()): OfferTokenCheck {
  if (typeof token !== 'string') return { ok: false, reason: 'bad' };
  const [offerId, imageId, exp, s] = token.split('.');
  if (!offerId || !imageId || !exp || !s || !UUID_RE.test(offerId) || !UUID_RE.test(imageId) || !/^[0-9a-z]+$/.test(exp)) return { ok: false, reason: 'bad' };
  const a = Buffer.from(sig(offerId, imageId, exp)), b = Buffer.from(s);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'bad' };
  return parseInt(exp, 36) < now ? { ok: false, reason: 'expired' } : { ok: true, offerId, imageId };
}

export const offerUrl = (baseUrl: string, offerId: string, imageId: string, now = Date.now()) => `${baseUrl.replace(/\/$/, '')}/po/${signOfferToken(offerId, imageId, now)}`;
