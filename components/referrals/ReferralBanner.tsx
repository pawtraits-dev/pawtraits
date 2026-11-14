'use client';

/**
 * Strip shown to a friend who arrived by a customer's link, for as long as their code is stored:
 * "{FirstName} gave you 10% off your first Pawtrait". The code is kept in localStorage.referralCode, which
 * is where checkout reads it. A link with ?ref=CODE stores it too. Shows nothing for a code that is invalid,
 * inactive, the visitor's own, or no longer eligible: the server's check at payment stays the authority.
 */
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { BANNER_DISMISSED_KEY, REFERRAL_STORAGE_KEY, bannerText, normaliseCode } from '@/lib/referrals/text';

export default function ReferralBanner({ className }: { className?: string }) {
  const [firstName, setFirstName] = useState<string | null | undefined>(undefined);

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
        let info: { valid?: boolean; firstName?: string | null } | null = null;
        try { info = JSON.parse(sessionStorage.getItem(cacheKey) || 'null'); } catch { /* ignore */ }
        if (!info) {
          const res = await fetch(`/api/public/referral-landing?code=${encodeURIComponent(code)}`, { credentials: 'include' });
          info = res.ok ? await res.json() : { valid: false };
          try { sessionStorage.setItem(cacheKey, JSON.stringify(info)); } catch { /* ignore */ }
        }
        if (!cancelled && info?.valid) setFirstName(info.firstName ?? null);
      } catch { /* no storage or network: no banner */ }
    })();
    return () => { cancelled = true; };
  }, []);

  if (firstName === undefined) return null;
  const { headline, sub } = bannerText(firstName);

  const dismiss = () => {
    try { localStorage.setItem(BANNER_DISMISSED_KEY, normaliseCode(localStorage.getItem(REFERRAL_STORAGE_KEY)) || ''); } catch { /* ignore */ }
    setFirstName(undefined);
  };

  return (
    <div role="status" className={`flex items-start gap-3 bg-purple-600 px-4 py-2.5 text-white ${className ?? ''}`}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{headline}</p>
        <p className="text-xs opacity-90">{sub}</p>
      </div>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="-mr-1 flex h-8 w-8 flex-none items-center justify-center rounded-full hover:bg-white/20">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
