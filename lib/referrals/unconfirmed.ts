/**
 * A referral code the browser claimed but the server could not check (the price check was 'unchecked').
 * create-intent records it as metadata.referralUnconfirmed / referralUnconfirmedDiscount (never as the real
 * referralCode), and the webhook stores both in orders.metadata so an admin can credit the referrer by hand.
 * Pure and client-safe.
 */
export interface UnconfirmedReferral { code: string; discountPence: number }

/** orders.metadata may arrive as an object, or as a JSON string (the webhook stores a stringified object) */
export function unconfirmedReferral(metadata: unknown): UnconfirmedReferral | null {
  let m: any = metadata;
  for (let i = 0; i < 2 && typeof m === 'string'; i++) {
    try { m = JSON.parse(m); } catch { return null; }
  }
  if (!m || typeof m !== 'object') return null;
  const code = typeof m.referralUnconfirmed === 'string' ? m.referralUnconfirmed.trim().toUpperCase() : '';
  if (!code) return null;
  const d = Number(m.referralUnconfirmedDiscount);
  return { code, discountPence: Number.isFinite(d) && d > 0 ? Math.round(d) : 0 };
}

export const unconfirmedReferralNote = (code: string) =>
  `This order used referral code ${code}, but it could not be checked at the time. If the buyer was a new customer with an account, credit the referrer by hand.`;
