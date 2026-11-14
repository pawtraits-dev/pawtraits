'use client';

/**
 * Email preferences. Opens from the signed link in our marketing emails (?p=<id>&t=<signature>) or,
 * for a signed-in customer, from their account (?me=1). No sign-in is needed for the link.
 * Everything goes through /api/public/email-preferences. Wording: lib/marketing/consent-copy.ts.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import UserAwareNavigation from '@/components/UserAwareNavigation';
import { CountryProvider } from '@/lib/country-context';
import { EMAIL_TOPICS, PREFS_COPY, type EmailTopics } from '@/lib/marketing/consent-copy';

const lifeSavers = { fontFamily: 'var(--font-life-savers), cursive' };
const OFF: EmailTopics = { new_designs: false, pet_days: false, offers: false };
type View = { status: 'subscribed' | 'unsubscribed' | 'none'; topics: EmailTopics; maskedEmail: string };

export default function EmailPreferencesPage() {
  const [key, setKey] = useState<{ p?: string; t?: string; me?: boolean } | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [topics, setTopics] = useState<EmailTopics>(OFF);
  const [bad, setBad] = useState<'link' | 'signin' | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [stopped, setStopped] = useState(false);

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    setKey(qs.get('me') ? { me: true } : { p: qs.get('p') || '', t: qs.get('t') || '' });
  }, []);

  const load = useCallback(async () => {
    if (!key) return;
    if (!key.me && (!key.p || !key.t)) { setBad('link'); return; }
    const qs = key.me ? 'me=1' : `p=${encodeURIComponent(key.p!)}&t=${encodeURIComponent(key.t!)}`;
    const r = await fetch(`/api/public/email-preferences?${qs}`, { credentials: 'include', cache: 'no-store' }).catch(() => null);
    if (!r || !r.ok) { setBad(key.me ? 'signin' : 'link'); return; }
    const d: View = await r.json();
    setView(d); setTopics(d.topics);
  }, [key]);
  useEffect(() => { load(); }, [load]);

  async function send(body: Record<string, unknown>, okText: string) {
    if (!key) return;
    setBusy(true); setMessage(null);
    try {
      const r = await fetch('/api/public/email-preferences', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...key, ...body }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setMessage({ ok: false, text: d.error || 'Something went wrong. Please try again.' });
      else { setView(d); setTopics(d.topics); setMessage({ ok: true, text: okText }); setStopped(body.action === 'stop' || (body.action === 'save' && d.status === 'unsubscribed')); }
    } catch {
      setMessage({ ok: false, text: 'Something went wrong. Please try again.' });
    }
    setBusy(false);
  }

  const anyOn = Object.values(topics).some(Boolean);
  const subscribed = view?.status === 'subscribed';

  return (
    <CountryProvider>
      <div className="min-h-screen bg-white text-gray-900">
        <UserAwareNavigation />
        <main className="mx-auto max-w-md px-5 py-12">
          {bad ? (
            <>
              <h1 className="text-[2rem] leading-tight" style={lifeSavers}>{PREFS_COPY.badHeading}</h1>
              <p className="mt-3 text-gray-700">{bad === 'signin' ? 'Please sign in to see your email preferences.' : PREFS_COPY.badBody}</p>
              <p className="mt-3 text-sm text-gray-600">Signed in? <Link href="/account" className="font-semibold text-purple-800 underline">Go to your account</Link>.</p>
            </>
          ) : !view ? (
            <div className="space-y-3" aria-busy="true"><div className="h-9 w-3/4 animate-pulse rounded bg-gray-200" /><div className="h-16 animate-pulse rounded bg-gray-100" /></div>
          ) : stopped && view.status === 'unsubscribed' ? (
            <>
              <h1 className="text-[2rem] leading-tight" style={lifeSavers}>{PREFS_COPY.stopped}</h1>
              <button type="button" onClick={() => { setStopped(false); setMessage(null); }} className="mt-4 text-purple-800 underline">{PREFS_COPY.changedMind}</button>
              <p className="mt-4 text-sm text-gray-600">{PREFS_COPY.note}</p>
            </>
          ) : (
            <>
              <h1 className="text-[2rem] leading-tight" style={lifeSavers}>{PREFS_COPY.heading}</h1>
              <p className="mt-3 text-gray-700">{view.status === 'none' ? PREFS_COPY.notYetIntro : PREFS_COPY.intro}</p>
              <p className="mt-2 text-sm text-gray-500">{view.maskedEmail}</p>

              <fieldset className="mt-5 space-y-3">
                <legend className="sr-only">Which emails would you like?</legend>
                {EMAIL_TOPICS.map(t => (
                  <label key={t.key} className="flex min-h-[56px] cursor-pointer items-start gap-3 rounded-xl border border-purple-200 bg-purple-50/40 p-3">
                    <input type="checkbox" role="switch" checked={topics[t.key]} onChange={e => setTopics(prev => ({ ...prev, [t.key]: e.target.checked }))} className="mt-1 h-6 w-6 shrink-0 accent-purple-600" />
                    <span><span className="block font-semibold text-gray-900">{t.title}</span><span className="block text-sm text-gray-600">{t.description}</span></span>
                  </label>
                ))}
              </fieldset>
              <p className="mt-3 text-sm text-gray-600">{PREFS_COPY.note}</p>

              {message && <p role={message.ok ? 'status' : 'alert'} className={`mt-4 rounded-lg px-3 py-2 text-sm ${message.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{message.text}</p>}

              {view.status === 'none' && (
                <button type="button" disabled={busy} onClick={() => send({ action: 'subscribe' }, PREFS_COPY.saved)}
                  className="mt-5 flex h-14 w-full items-center justify-center rounded-xl bg-purple-600 text-lg font-semibold text-white disabled:opacity-60">{busy ? 'Saving…' : PREFS_COPY.yesPlease}</button>
              )}
              <button type="button" disabled={busy || (view.status !== 'subscribed' && !anyOn)} onClick={() => send({ action: 'save', topics }, PREFS_COPY.saved)}
                className={`mt-3 flex h-14 w-full items-center justify-center rounded-xl text-lg font-semibold disabled:opacity-50 ${view.status === 'none' ? 'border-2 border-purple-200 text-purple-800' : 'bg-purple-600 text-white'}`}>{busy && view.status !== 'none' ? 'Saving…' : PREFS_COPY.save}</button>
              {subscribed && (
                <button type="button" disabled={busy} onClick={() => send({ action: 'stop' }, PREFS_COPY.stopped)}
                  className="mt-3 flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold text-gray-600 hover:text-gray-900 disabled:opacity-60">{PREFS_COPY.stopAll}</button>
              )}
            </>
          )}
        </main>
      </div>
    </CountryProvider>
  );
}
