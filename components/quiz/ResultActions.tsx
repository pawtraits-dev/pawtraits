'use client';

/**
 * Result page actions: picture + share, "Put Biscuit in this Pawtrait", and save by email.
 * Share uses the phone's share sheet with the Stories card image where supported, then a plain
 * link share, then copy-link. Saving signed in attaches the type to the pet; otherwise we email
 * a sign-in link that brings them back here with ?save=1 and saves it.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Share2 } from 'lucide-react';
import ResultPicture from './ResultPicture';
import { track } from '@/lib/tracking/events';

export interface ResultActionsProps {
  shareCode: string; animal: 'dog' | 'cat'; code: string; typeName: string;
  petName: string; breedId: string | null; breedName: string | null;
  imageId: string | null; imageKind: 'breed' | 'design' | null; canPaintBreed: boolean;
}

export function ResultHeroPicture(p: ResultActionsProps & { onImage?: (id: string) => void }) {
  return (
    <ResultPicture shareCode={p.shareCode} animal={p.animal} code={p.code} breedId={p.breedId} breedName={p.breedName}
      petName={p.petName} initialImageId={p.imageId} initialKind={p.imageKind} canPaintBreed={p.canPaintBreed} onImage={p.onImage} />
  );
}

export function ShareButton({ shareCode, petName, typeName, code }: Pick<ResultActionsProps, 'shareCode' | 'petName' | 'typeName' | 'code'>) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== 'undefined' ? `${window.location.origin}/quiz/pawsonality/r/${shareCode}` : '';
  const text = `${petName} is ${typeName}! What's your pet's Pawsonality?`;

  const recorded = (platform: string) => {
    track.quizShare('pawsonality', code, platform);
    fetch(`/api/public/quiz-results/${shareCode}/shared`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform }),
    }).catch(() => {});
  };

  async function share() {
    try {
      if (navigator.share) {
        // Prefer sharing the Stories card itself (Instagram/WhatsApp status)
        try {
          const blob = await fetch(`/api/public/quiz-results/${shareCode}/card?format=story`).then(r => (r.ok ? r.blob() : null));
          const file = blob ? new File([blob], `${petName}-pawsonality.png`, { type: 'image/png' }) : null;
          if (file && navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], text: `${text} ${url}` });
            recorded('native_share');
            return;
          }
        } catch (e: any) { if (e?.name === 'AbortError') return; }
        await navigator.share({ title: `${petName}'s Pawsonality`, text, url });
        recorded('native_share');
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true); setTimeout(() => setCopied(false), 2500);
      recorded('copy_link');
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2500); recorded('copy_link'); } catch { /* nothing more to try */ }
      }
    }
  }

  return (
    <button type="button" onClick={share}
      className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-purple-200 bg-white text-base font-bold text-purple-800 hover:bg-purple-50">
      {copied ? <><Check className="h-5 w-5" aria-hidden="true" /> Link copied</> : <><Share2 className="h-5 w-5" aria-hidden="true" /> Share {petName}&rsquo;s result</>}
    </button>
  );
}

export function MakePawtrait({ petName, typeName, code, imageId, breedId, animal }: {
  petName: string; typeName: string; code: string; imageId: string | null; breedId: string | null; animal: 'dog' | 'cat';
}) {
  const browse = breedId ? `/browse?type=${animal === 'cat' ? 'cats' : 'dogs'}&breed=${breedId}` : `/browse?type=${animal === 'cat' ? 'cats' : 'dogs'}`;
  return (
    <section className="border-y border-purple-100 bg-[#FBF9FE] px-5 py-6">
      <div className="mx-auto max-w-md">
        <h2 className="text-xl font-bold">Make {petName}&rsquo;s Pawtrait as {typeName}</h2>
        <p className="mt-1 text-sm text-gray-700">Add {petName}&rsquo;s photo and Pawcasso paints them in. Prints from £25, or a digital download.</p>
        {imageId ? (
          <Link href={`/customise/${imageId}?start=photo&src=pawsonality`} onClick={() => track.quizResultDesignClick('pawsonality', code, imageId)}
            className="mt-4 flex h-[52px] items-center justify-center rounded-xl bg-purple-700 text-base font-bold text-white hover:bg-purple-800">
            Add {petName}&rsquo;s photo
          </Link>
        ) : (
          <Link href={browse} className="mt-4 flex h-[52px] items-center justify-center rounded-xl bg-purple-700 text-base font-bold text-white hover:bg-purple-800">
            Choose a design for {petName}
          </Link>
        )}
        {imageId && <Link href={browse} className="mt-3 inline-block text-sm font-semibold text-purple-800 underline">Or see every design</Link>}
      </div>
    </section>
  );
}

export function SaveResult({ shareCode, petName, signedIn }: { shareCode: string; petName: string; signedIn: boolean }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'emailed' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function save(withEmail?: string) {
    setState('busy'); setMessage(null);
    try {
      const r = await fetch(`/api/public/quiz-results/${shareCode}/save`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: withEmail }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) { setState('error'); setMessage(body.error || 'Could not save just now.'); return; }
      setState(body.saved === 'pet' ? 'saved' : 'emailed');
    } catch {
      setState('error'); setMessage('No connection. Please try again.');
    }
  }

  // Back from the email link (signed in now): save to the pet straight away
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    if (qs.get('save') === '1') {
      save();
      qs.delete('save');
      window.history.replaceState(null, '', `${window.location.pathname}${qs.toString() ? `?${qs}` : ''}`);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (state === 'saved') {
    return <p role="status" className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-800"><Check className="h-4 w-4" aria-hidden="true" /> Saved to {petName}&rsquo;s profile.</p>;
  }
  if (state === 'emailed') {
    return <p role="status" className="rounded-xl bg-purple-50 px-4 py-3 text-sm text-purple-900">Check your inbox: tap the link in our email and {petName}&rsquo;s Pawsonality is saved.</p>;
  }
  if (signedIn) {
    return (
      <div className="space-y-2">
        <button type="button" onClick={() => save()} disabled={state === 'busy'}
          className="h-12 w-full rounded-xl border-[1.5px] border-purple-200 bg-white font-bold text-purple-800 hover:bg-purple-50 disabled:opacity-60">
          {state === 'busy' ? 'Saving…' : `Save to ${petName}’s profile`}
        </button>
        {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
      </div>
    );
  }
  return (
    <form onSubmit={e => { e.preventDefault(); save(email); }} className="space-y-2">
      <div className="flex gap-2">
        <label htmlFor="save-email" className="sr-only">Email address</label>
        <input id="save-email" type="email" autoComplete="email" required placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)}
          className="h-12 min-w-0 flex-1 rounded-xl border-[1.5px] border-gray-300 px-4 text-base focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-200" />
        <button type="submit" disabled={state === 'busy'}
          className="h-12 shrink-0 rounded-xl border-[1.5px] border-purple-200 bg-white px-5 font-bold text-purple-800 hover:bg-purple-50 disabled:opacity-60">
          {state === 'busy' ? 'Saving…' : 'Save'}
        </button>
      </div>
      {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
    </form>
  );
}

