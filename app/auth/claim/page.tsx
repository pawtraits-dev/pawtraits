'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/**
 * Landing page for the "account ready" email link. Deliberately needs a tap: email security
 * scanners open links automatically, and we don't want them to use up the sign-in.
 */
export default function ClaimPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<'ready' | 'working' | 'error'>('ready');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('t'));
  }, []);

  async function claim() {
    if (!token) return;
    setState('working');
    const res = await fetch('/api/auth/claim', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ token }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.redirectTo) {
      router.replace(data.redirectTo);
      return;
    }
    setState('error');
    setMessage(data.error || 'Something went wrong.');
  }

  return (
    <main className="min-h-[100dvh] bg-gradient-to-b from-purple-50 to-white flex items-center justify-center px-5">
      <div className="w-full max-w-sm text-center">
        <div className="text-6xl mb-4" aria-hidden>🎁</div>
        <h1 className="text-2xl font-bold text-gray-900">Your free download is ready</h1>
        <p className="mt-2 text-gray-600">Tap below to open your Pawtraits account and grab your full-resolution portrait.</p>

        {token ? (
          <button onClick={claim} disabled={state === 'working'}
            className="mt-8 w-full h-14 rounded-2xl bg-purple-600 text-white text-lg font-semibold shadow-lg active:scale-[0.99] disabled:opacity-70">
            {state === 'working' ? 'Opening your account…' : 'Unlock my download'}
          </button>
        ) : (
          <p className="mt-8 text-red-600">This link looks incomplete — please use the button in your email.</p>
        )}

        {state === 'error' && (
          <div className="mt-6 rounded-xl bg-red-50 border border-red-100 p-4 text-sm text-red-700">
            <p>{message}</p>
            <Link href="/auth/login" className="mt-2 inline-block font-medium underline">Sign in with your email instead</Link>
          </div>
        )}
      </div>
    </main>
  );
}
