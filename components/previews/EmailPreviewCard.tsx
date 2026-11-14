'use client';

/**
 * "Email me this preview": a compact card under the preview actions (never a pop-up, never in the way of
 * the buy button). Visitors who are not signed in type an address (and may tick the marketing box);
 * signed-in customers get a one-tap button. Wording: lib/previews/copy.ts and lib/marketing/consent-copy.ts.
 */
import { useEffect, useState } from 'react';
import MarketingOptIn from '@/components/marketing/MarketingOptIn';
import { PREVIEW_COPY } from '@/lib/previews/copy';
import { track } from '@/lib/tracking/events';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailPreviewCard({ imageId, signedIn }: { imageId: string; signedIn?: boolean }) {
  const [isIn, setIsIn] = useState<boolean | null>(signedIn ?? null);
  const [email, setEmail] = useState('');
  const [tick, setTick] = useState(false);
  const [trap, setTrap] = useState('');   // honeypot: people never see or fill this
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle');
  const [masked, setMasked] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (signedIn !== undefined) { setIsIn(signedIn); return; }
    fetch('/api/auth/check', { credentials: 'include' }).then(r => (r.ok ? r.json() : null)).then(d => setIsIn(!!d?.isAuthenticated)).catch(() => setIsIn(false));
  }, [signedIn]);

  async function send() {
    if (!isIn && !EMAIL_RE.test(email.trim())) { setError(PREVIEW_COPY.errBad); return; }
    setState('busy'); setError(null);
    try {
      const r = await fetch('/api/public/previews/email', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId, ...(isIn ? {} : { email: email.trim(), marketingOptIn: tick }), website: trap }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || PREVIEW_COPY.errOther); setState(masked ? 'sent' : 'idle'); return; }
      setMasked(d.masked || ''); setState('sent');
      track.lead(imageId);
    } catch {
      setError(PREVIEW_COPY.errOther); setState(masked ? 'sent' : 'idle');
    }
  }

  if (isIn === null) return null;
  const busy = state === 'busy';

  if (state === 'sent') {
    return (
      <section aria-label="Email me this preview" className="mt-4 rounded-2xl border border-purple-200 bg-white p-4">
        {isIn ? (
          <p role="status" className="text-sm font-medium text-gray-900">{PREVIEW_COPY.signedInSent(masked)}</p>
        ) : (
          <>
            <p role="status" className="font-semibold text-gray-900">{PREVIEW_COPY.sentHeading}</p>
            <p className="mt-1 text-sm text-gray-700">{PREVIEW_COPY.sentLine(masked)}</p>
          </>
        )}
        {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
        <div className="mt-2 flex flex-wrap gap-x-5">
          <button type="button" onClick={send} disabled={busy} className="min-h-[44px] text-sm font-semibold text-purple-800 underline disabled:opacity-60">{PREVIEW_COPY.again}</button>
          {!isIn && <button type="button" onClick={() => { setState('idle'); setEmail(''); setError(null); setMasked(''); }} className="min-h-[44px] text-sm font-semibold text-purple-800 underline">{PREVIEW_COPY.different}</button>}
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Email me this preview" className="mt-4 rounded-2xl border border-purple-200 bg-white p-4">
      <h2 className="font-semibold text-gray-900">{PREVIEW_COPY.heading}</h2>
      <p className="mt-0.5 text-sm text-gray-700">{PREVIEW_COPY.line}</p>
      <form noValidate onSubmit={e => { e.preventDefault(); send(); }} className="mt-3">
        {!isIn && (
          <>
            <label htmlFor="preview-email" className="block text-sm font-medium text-gray-900">{PREVIEW_COPY.fieldLabel}</label>
            <input id="preview-email" type="email" autoComplete="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={PREVIEW_COPY.placeholder}
              aria-invalid={!!error} aria-describedby={error ? 'preview-email-error' : undefined}
              className="mt-1 h-12 w-full rounded-xl border border-gray-300 px-3 text-base text-gray-900" />
            {/* honeypot */}
            <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
              <label>Website<input tabIndex={-1} autoComplete="off" value={trap} onChange={e => setTrap(e.target.value)} /></label>
            </div>
            <MarketingOptIn checked={tick} onChange={setTick} className="mt-1" />
          </>
        )}
        {error && <p id="preview-email-error" role="alert" className="mt-1 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={busy} className="mt-2 flex h-12 w-full items-center justify-center rounded-xl border-2 border-purple-200 font-semibold text-purple-800 disabled:opacity-60">
          {busy ? PREVIEW_COPY.sending : PREVIEW_COPY.button}
        </button>
      </form>
    </section>
  );
}
