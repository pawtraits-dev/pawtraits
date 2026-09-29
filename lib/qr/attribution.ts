import { createHmac, createHash, randomUUID, timingSafeEqual } from 'crypto';

/** Cookie holding the last sticker scan (signed). Read server-side at checkout. */
export const QR_ATTRIBUTION_COOKIE = 'pt_qr';
/** Anonymous visitor id, used for unique-visitor counts and repeat detection. */
export const VISITOR_COOKIE = 'pt_vid';

export const ATTRIBUTION_WINDOW_DAYS = 30;
export const ATTRIBUTION_MAX_AGE_S = ATTRIBUTION_WINDOW_DAYS * 24 * 60 * 60;
export const VISITOR_MAX_AGE_S = 365 * 24 * 60 * 60;

export interface QrAttribution {
  scanId: string;
  imageId: string | null;
  locationId: string | null;
  size: string | null;
  ts: number; // ms epoch
}

function secret(): string {
  const s = process.env.QR_ATTRIBUTION_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('⚠️ QR_ATTRIBUTION_SECRET not set — using fallback; set it in Vercel');
    }
    return `pawtraits-qr-fallback-${process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-16) ?? 'dev'}`;
  }
  return s;
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function encodeAttribution(a: QrAttribution): string {
  const payload = Buffer.from(JSON.stringify(a)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

/** Returns null if missing, tampered, malformed or older than the attribution window. */
export function decodeAttribution(value?: string | null): QrAttribution | null {
  if (!value) return null;
  const [payload, sig] = value.split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as QrAttribution;
    if (!data.scanId || typeof data.ts !== 'number') return null;
    if (Date.now() - data.ts > ATTRIBUTION_MAX_AGE_S * 1000) return null;
    return data;
  } catch {
    return null;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validVisitorId(v?: string | null): string | null {
  return v && UUID_RE.test(v) ? v : null;
}
export const newVisitorId = () => randomUUID();

export function hashIp(ip?: string | null): string | null {
  if (!ip) return null;
  const salt = process.env.QR_IP_SALT || secret();
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

/** Link previewers, crawlers and uptime checkers — recorded but excluded from counts. */
const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|discord|slack|twitter|linkedin|skype|preview|headless|curl|wget|python-requests|node-fetch|axios|monitor|pingdom|uptime/i;
export function isBotUserAgent(ua?: string | null): boolean {
  return !ua || BOT_RE.test(ua);
}
