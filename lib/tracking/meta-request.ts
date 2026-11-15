import type { NextRequest } from 'next/server';
import { CONSENT_COOKIE, parseConsent } from './consent';

export interface MetaClient {
  fbp: string | null;
  fbc: string | null;
  ip: string | null;
  ua: string | null;
  url: string | null;
}

/**
 * Who is asking, for Meta's Conversions API: null unless the visitor accepted marketing cookies.
 * Same data (and same shape) the checkout snapshot stores in pending_checkouts.client.
 */
export function metaClientFromRequest(request: NextRequest): MetaClient | null {
  const consent = parseConsent(request.cookies.get(CONSENT_COOKIE)?.value);
  if (!consent?.marketing) return null;
  return {
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    ua: request.headers.get('user-agent'),
    fbp: request.cookies.get('_fbp')?.value ?? null,
    fbc: request.cookies.get('_fbc')?.value ?? null,
    url: request.headers.get('referer'),
  };
}
