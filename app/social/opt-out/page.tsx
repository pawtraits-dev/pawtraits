'use client';

/**
 * "Don't feature my pet" page, linked from order emails (?o=<order>&t=<signature>).
 * A button confirms (so email link scanners can't opt people out by visiting the link).
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import UserAwareNavigation from '@/components/UserAwareNavigation';
import { CountryProvider } from '@/lib/country-context';

const lifeSavers = { fontFamily: 'var(--font-life-savers), cursive' };

export default function SocialOptOutPage() {
  const [params, setParams] = useState<{ o: string; t: string } | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    setParams({ o: qs.get('o') || '', t: qs.get('t') || '' });
  }, []);

  async function confirm() {
    if (!params) return;
    setState('busy'); setError(null);
    try {
      const res = await fetch('/api/public/social/opt-out', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Something went wrong. Please try again.');
      setState('done');
    } catch (e: any) {
      setState('error'); setError(e.message);
    }
  }

  const linkBroken = params && (!params.o || !params.t);

  return (
    <CountryProvider>
      <div className="min-h-screen bg-white text-gray-900">
        <UserAwareNavigation />
        <main className="mx-auto max-w-md px-5 py-12">
          {state === 'done' ? (
            <>
              <h1 className="text-[2rem] leading-tight" style={lifeSavers}>Done, no starring roles</h1>
              <p className="mt-3 text-gray-700">
                We won&rsquo;t feature your pets&rsquo; photos or Pawtraits on our website or Instagram, for this order or any future ones.
                If one has already been posted, we&rsquo;ll take it down.
              </p>
              <Link href="/" className="mt-6 inline-flex h-12 items-center justify-center rounded-xl border-2 border-purple-200 px-6 font-semibold text-purple-800">Back to Pawtraits</Link>
            </>
          ) : (
            <>
              <h1 className="text-[2rem] leading-tight" style={lifeSavers}>Keep your pet out of the spotlight?</h1>
              <p className="mt-3 text-gray-700">
                Now and then we show customers&rsquo; Pawtraits, with the original photo, on our website and Instagram. We only ever
                use the pet&rsquo;s first name and your town, never your name or address.
              </p>
              <p className="mt-3 text-gray-700">Prefer not? One tap and we won&rsquo;t feature any of your orders.</p>
              {linkBroken && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">This link is incomplete. Please use the link in your order email, or email support@pawtraits.pics.</p>}
              {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <button type="button" onClick={confirm} disabled={!params || !!linkBroken || state === 'busy'}
                className="mt-6 flex h-14 w-full items-center justify-center rounded-xl bg-purple-600 text-lg font-semibold text-white disabled:opacity-60">
                {state === 'busy' ? 'Saving…' : 'Don’t feature my pets'}
              </button>
              <Link href="/" className="mt-3 flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold text-purple-800">
                That&rsquo;s fine, show them off
              </Link>
            </>
          )}
        </main>
      </div>
    </CountryProvider>
  );
}
