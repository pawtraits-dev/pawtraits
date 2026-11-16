'use client';

/**
 * "Email me this preview": a compact card under the preview actions (never a pop-up, never in the way of
 * the buy button). Visitors who are not signed in type an address, which also signs them up (no separate box; confirmed when they open the link);
 * signed-in customers get a one-tap button. Wording: lib/previews/copy.ts and lib/marketing/consent-copy.ts.
 */
import { useEffect, useState } from 'react';
import { PHOTO_WORDS_VERSION, PREVIEW_COPY } from '@/lib/previews/copy';
import { cleanBirthday } from '@/lib/offers/dates';
import { track } from '@/lib/tracking/events';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function EmailPreviewCard({ imageId, signedIn }: { imageId: string; signedIn?: boolean }) {
  const [isIn, setIsIn] = useState<boolean | null>(signedIn ?? null);
  const [email, setEmail] = useState('');
  const [bDay, setBDay] = useState(''); const [bMonth, setBMonth] = useState(''); const [bYear, setBYear] = useState('');   // optional birthday
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
    // Optional birthday: sent only when it is a real date; anything else (30 Feb, a half-filled box) is quietly left out
    const birthday = !isIn ? cleanBirthday({ day: bDay, month: bMonth, year: bYear }) : null;
    try {
      const r = await fetch('/api/public/previews/email', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId, ...(isIn ? {} : { email: email.trim(), wording: PHOTO_WORDS_VERSION, ...(birthday ? { birthday } : {}) }), website: trap }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || PREVIEW_COPY.errOther); setState(masked ? 'sent' : 'idle'); return; }
      setMasked(d.masked || ''); setState('sent');
      track.lead(imageId, 'preview_email', typeof d.metaEventId === 'string' ? d.metaEventId : undefined);
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
      <p className="mt-0.5 text-sm text-gray-700">{isIn ? PREVIEW_COPY.lineSignedIn : PREVIEW_COPY.line}</p>
      <form noValidate onSubmit={e => { e.preventDefault(); send(); }} className="mt-3">
        {!isIn && (
          <>
            <label htmlFor="preview-email" className="block text-sm font-medium text-gray-900">{PREVIEW_COPY.fieldLabel}</label>
            <input id="preview-email" type="email" autoComplete="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={PREVIEW_COPY.placeholder}
              aria-invalid={!!error} aria-describedby={error ? 'preview-email-error' : undefined}
              className="mt-1 h-12 w-full rounded-xl border border-gray-300 px-3 text-base text-gray-900" />
            <fieldset className="mt-3">
              <legend className="block text-sm font-medium text-gray-900">{PREVIEW_COPY.birthdayLabel} <span className="font-normal text-gray-600">({PREVIEW_COPY.birthdayOptional})</span></legend>
              <div className="mt-1 flex gap-2">
                <select aria-label={PREVIEW_COPY.birthdayDay} value={bDay} onChange={e => setBDay(e.target.value)} className="h-12 w-20 rounded-xl border border-gray-300 bg-white px-2 text-base text-gray-900">
                  <option value="">{PREVIEW_COPY.birthdayDay}</option>
                  {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                </select>
                <select aria-label={PREVIEW_COPY.birthdayMonth} value={bMonth} onChange={e => setBMonth(e.target.value)} className="h-12 min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-2 text-base text-gray-900">
                  <option value="">{PREVIEW_COPY.birthdayMonth}</option>
                  {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
                <input aria-label={PREVIEW_COPY.birthdayYear} placeholder={PREVIEW_COPY.birthdayYear} inputMode="numeric" maxLength={4} value={bYear} onChange={e => setBYear(e.target.value.replace(/\D/g, ''))} className="h-12 w-28 rounded-xl border border-gray-300 px-2 text-base text-gray-900" />
              </div>
              <p className="mt-1 text-sm text-gray-600">{PREVIEW_COPY.birthdayHelp}</p>
            </fieldset>
            {/* honeypot */}
            <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
              <label>Website<input tabIndex={-1} autoComplete="off" value={trap} onChange={e => setTrap(e.target.value)} /></label>
            </div>
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
