/**
 * Cookie consent (UK GDPR / PECR). Marketing + analytics cookies only after opt-in.
 * Stored in a first-party cookie readable by client and server:
 *   pt_consent = "v1.a1.m0"  → version 1, analytics granted, marketing denied
 */
export const CONSENT_COOKIE = 'pt_consent';
export const CONSENT_MAX_AGE_S = 180 * 24 * 60 * 60; // re-ask after ~6 months

export interface ConsentState {
  analytics: boolean;
  marketing: boolean;
}

export function parseConsent(value?: string | null): ConsentState | null {
  if (!value) return null;
  const m = /^v1\.a([01])\.m([01])$/.exec(value);
  if (!m) return null;
  return { analytics: m[1] === '1', marketing: m[2] === '1' };
}

export function serialiseConsent(c: ConsentState): string {
  return `v1.a${c.analytics ? 1 : 0}.m${c.marketing ? 1 : 0}`;
}

/** Client-side read */
export function readConsent(): ConsentState | null {
  if (typeof document === 'undefined') return null;
  const hit = document.cookie.split('; ').find(c => c.startsWith(`${CONSENT_COOKIE}=`));
  return parseConsent(hit ? decodeURIComponent(hit.split('=')[1]) : null);
}

export function writeConsent(c: ConsentState) {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${CONSENT_COOKIE}=${serialiseConsent(c)}; Path=/; Max-Age=${CONSENT_MAX_AGE_S}; SameSite=Lax${secure}`;
  window.dispatchEvent(new CustomEvent('pt:consent', { detail: c }));
}

export const OPEN_CONSENT_EVENT = 'pt:open-consent';
export function openConsentSettings() {
  window.dispatchEvent(new Event(OPEN_CONSENT_EVENT));
}
