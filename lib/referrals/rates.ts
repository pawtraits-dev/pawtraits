/** Pure helpers for the customer-referral percentages (settings referral_friend_discount_pct / referral_referrer_credit_pct). Client-safe. */

export const DEFAULT_REFERRAL_RATES = { friendPct: 10, referrerPct: 10 } as const;
export interface ReferralRates { friendPct: number; referrerPct: number }

/** pct / 100, kept between 0 and 0.5. Anything that is not a number counts as 0. */
export function rateFraction(pct: number): number {
  if (typeof pct !== 'number' || !Number.isFinite(pct)) return 0;
  return Math.min(0.5, Math.max(0, pct / 100));
}

/** 20 → "20%" (whole number) */
export function formatPct(pct: number): string {
  return `${Math.round(Number.isFinite(pct) ? pct : 0)}%`;
}

/** The two settings keys, in the order the admin card shows them */
export const SETTING_RATE_KEYS = ['referral_friend_discount_pct', 'referral_referrer_credit_pct'] as const;
