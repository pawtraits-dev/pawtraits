'use client';

/**
 * Strip shown to a friend who arrived by a customer's link, for as long as their code is stored:
 * "{FirstName} gave you {pct} off your first Pawtrait" (the percentage is an admin setting). The code is kept in localStorage.referralCode, which
 * is where checkout reads it. A link with ?ref=CODE stores it too. Shows nothing for a code that is invalid,
 * inactive, the visitor's own, or no longer eligible: the server's check at payment stays the authority.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { useReferralRates } from '@/lib/referrals/use-rates';
import { BANNER_DISMISSED_KEY, REFERRAL_STORAGE_KEY, bannerText, normaliseCode } from '@/lib/referrals/text';

export default function ReferralBanner({ className }: { className?: string }) {
  const [firstName, setFirstName] = useState<string | null | undefined>(undefined);
  const [signedIn, setSignedIn] = useState(true);
  const [code, setCode] = useState<string | null>(null);
  const rates = useReferralRates();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let code: string | null = null;
      try {
        const fromUrl = normaliseCode(new URLSearchParams(window.location.search).get('ref'));
        if (fromUrl) localStorage.setItem(REFERRAL_STORAGE_KEY, fromUrl);
        code = normaliseCode(localStorage.getItem(REFERRAL_STORAGE_KEY));
        if (!code || localStorage.getItem(BANNER_DISMISSED_KEY) === code) return;
        const cacheKey = `pt_ref_landing:${code}`;
        let info: { valid?: boolean; firstName?: string | null; signedIn?: boolean } | null = null;
        try { info = JSON.parse(sessionStorage.getItem(cacheKey) || 'null'); } catch { /* ignore */ }
        if (!info) {
          const res = await fetch(`/api/public/referral-landing?code=${encodeURIComponent(code)}`, { credentials: 'include' });
          info = res.ok ? await res.json() : { valid: false };
          if (info?.signedIn !== false) { try { sessionStorage.setItem(cacheKey, JSON.stringify(info)); } catch { /* ignore */ } }   // a guest's answer is not kept: they will sign in soon
        }
        if (!cancelled && info?.valid) { setSignedIn(info.signedIn !== false); setCode(code); setFirstName(info.firstName ?? null); }
      } catch { /* no storage or network: no banner */ }
    })();
    return () => { cancelled = true; };
  }, []);

  if (firstName === undefined) return null;
  const { headline, sub } = bannerText(firstName, rates, signedIn);

  const dismiss = () => {
    try { localStorage.setItem(BANNER_DISMISSED_KEY, normaliseCode(localStorage.getItem(REFERRAL_STORAGE_KEY)) || ''); } catch { /* ignore */ }
    setFirstName(undefined);
  };

  return (
    <div role="status" className={`flex items-start gap-3 bg-purple-600 px-4 py-2.5 text-white ${className ?? ''}`}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{headline}</p>
        <p className="text-xs opacity-90">{sub}{!signedIn && code && <> <Link href={`/signup/user?ref=${encodeURIComponent(code)}`} className="font-semibold underline">Create an account</Link></>}</p>
      </div>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="-mr-1 flex h-8 w-8 flex-none items-center justify-center rounded-full hover:bg-white/20">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
