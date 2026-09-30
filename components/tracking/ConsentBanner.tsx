'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { readConsent, writeConsent, OPEN_CONSENT_EVENT } from '@/lib/tracking/consent';

/** Mobile-first cookie banner: bottom sheet, big thumb-friendly buttons, equal-weight Accept/Reject. */
export default function ConsentBanner() {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    if (!readConsent()) setOpen(true);
    const reopen = () => {
      const c = readConsent();
      setAnalytics(c?.analytics ?? true);
      setMarketing(c?.marketing ?? true);
      setDetails(true);
      setOpen(true);
    };
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
  }, []);

  // Staff pages don't load any trackers — no need to ask there
  if (!open || pathname?.startsWith('/admin')) return null;

  const decide = (a: boolean, m: boolean) => { writeConsent({ analytics: a, marketing: m }); setOpen(false); };

  return (
    <div role="dialog" aria-modal="false" aria-labelledby="pt-consent-title"
      className="fixed inset-x-0 bottom-0 z-[100] p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-xl rounded-2xl border border-purple-100 bg-white shadow-2xl p-4 sm:p-5">
        <p id="pt-consent-title" className="font-semibold text-gray-900">🍪 A quick word about cookies</p>
        <p className="mt-1 text-sm text-gray-600">
          We use a few cookies to make the site work, and — if you’re happy — some to understand what people like and to show you
          Pawtraits on Facebook, Instagram and Google. <Link href="/privacy" className="underline text-purple-700">Privacy policy</Link>
        </p>

        {details && (
          <div className="mt-3 space-y-2 text-sm">
            <label className="flex items-start gap-3 rounded-lg bg-gray-50 p-3">
              <input type="checkbox" checked disabled className="mt-1 h-5 w-5" />
              <span><span className="font-medium">Essential</span><br /><span className="text-gray-500">Your basket, sign-in and checkout. Always on.</span></span>
            </label>
            <label className="flex items-start gap-3 rounded-lg bg-gray-50 p-3">
              <input type="checkbox" checked={analytics} onChange={e => setAnalytics(e.target.checked)} className="mt-1 h-5 w-5 accent-purple-600" />
              <span><span className="font-medium">Analytics</span><br /><span className="text-gray-500">Google Analytics — which pages and designs people like.</span></span>
            </label>
            <label className="flex items-start gap-3 rounded-lg bg-gray-50 p-3">
              <input type="checkbox" checked={marketing} onChange={e => setMarketing(e.target.checked)} className="mt-1 h-5 w-5 accent-purple-600" />
              <span><span className="font-medium">Marketing</span><br /><span className="text-gray-500">Meta (Facebook/Instagram) and Google Ads — reminders about the portraits you looked at.</span></span>
            </label>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          {details ? (
            <>
              <button onClick={() => decide(false, false)} className="h-12 rounded-xl border border-gray-300 font-medium text-gray-800">Reject all</button>
              <button onClick={() => decide(analytics, marketing)} className="h-12 rounded-xl bg-purple-600 font-semibold text-white">Save choices</button>
            </>
          ) : (
            <>
              <button onClick={() => decide(false, false)} className="h-12 rounded-xl border border-gray-300 font-medium text-gray-800">Reject</button>
              <button onClick={() => decide(true, true)} className="h-12 rounded-xl bg-purple-600 font-semibold text-white">Accept all</button>
            </>
          )}
        </div>
        {!details && (
          <button onClick={() => setDetails(true)} className="mt-2 w-full text-center text-sm text-purple-700 underline py-1">Choose which cookies</button>
        )}
      </div>
    </div>
  );
}
