'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_REFERRAL_RATES, type ReferralRates } from '@/lib/referrals/rates';

let cached: ReferralRates | null = null;

/** The referral percentages for wording. Starts at the defaults (10/10) and is replaced by the settings once they load; stays on the defaults if the fetch fails. */
export function useReferralRates(): ReferralRates {
  const [rates, setRates] = useState<ReferralRates>(cached ?? { ...DEFAULT_REFERRAL_RATES });
  useEffect(() => {
    if (cached) return;
    let live = true;
    fetch('/api/public/referral-rates')
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (j && Number.isFinite(j.friendPct) && Number.isFinite(j.referrerPct)) {
          cached = { friendPct: j.friendPct, referrerPct: j.referrerPct };
          if (live) setRates(cached);
        }
      })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  return rates;
}
