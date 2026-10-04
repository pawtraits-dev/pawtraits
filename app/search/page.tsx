'use client';

/**
 * /search?q=&tag=&animal= — one search for the shop (docs/specs/collections-plan.md, phase 3).
 * Jump-to chips for matching breeds and collections, then designs ranked by match.
 * ?tag= is the "See more crown designs" link from a design page.
 * Data: /api/public/search.
 */
import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import UserAwareNavigation from '@/components/UserAwareNavigation';
import { CountryProvider } from '@/lib/country-context';
import DesignGrid, { GridSkeleton, PetCountFilter } from '@/components/collections/DesignGrid';
import { track } from '@/lib/tracking/events';

const lifeSavers = { fontFamily: 'var(--font-life-savers), cursive' };
const IDEAS = ['Christmas', 'Halloween', 'Birthday', 'Crown', 'Football', 'Leo'];

interface Result {
  query: string; tag: string | null; total: number; page: number; pageSize: number;
  breeds: { id: string; name: string; slug: string; animal_type: 'dog' | 'cat' }[];
  collections: { name: string; shortName: string | null; path: string; kind: string }[];
  designs: any[];
}

export default function SearchPage() {
  return <CountryProvider><Suspense fallback={<div className="min-h-screen bg-white" />}><SearchContent /></Suspense></CountryProvider>;
}

function SearchContent() {
  const sp = useSearchParams();
  const router = useRouter();
  const q = sp.get('q') ?? '';
  const tag = sp.get('tag');
  const animal = sp.get('animal');
  const pets = sp.get('pets') === '1' ? 1 : sp.get('pets') === '2' ? 2 : null;
  const [text, setText] = useState(q);
  const [result, setResult] = useState<Result | null>(null);
  const [extra, setExtra] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setText(q); }, [q]);
  useEffect(() => { if (!q && !tag) inputRef.current?.focus(); }, [q, tag]);

  // Update the address as they type (debounced); results follow the address
  useEffect(() => {
    if (text === q) return;
    const t = setTimeout(() => {
      const qs = new URLSearchParams();
      if (text.trim()) qs.set('q', text.trim());
      if (animal) qs.set('animal', animal);
      router.replace(`/search${qs.toString() ? `?${qs}` : ''}`, { scroll: false });
    }, 350);
    return () => clearTimeout(t);
  }, [text, q, animal, router]);

  useEffect(() => {
    if (!q.trim() && !tag) { setResult(null); return; }
    let cancelled = false;
    setLoading(true); setError(false); setExtra([]);
    const qs = new URLSearchParams();
    if (q) qs.set('q', q);
    if (tag) qs.set('tag', tag);
    if (animal) qs.set('animal', animal);
    if (pets) qs.set('pets', String(pets));
    fetch(`/api/public/search?${qs}`).then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => { if (!cancelled) { setResult(d); if (q || tag) track.search(tag || q, d.total, tag ? 'tag' : 'query'); } })
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [q, tag, animal, pets]);

  const more = async () => {
    if (!result) return;
    const qs = new URLSearchParams();
    if (q) qs.set('q', q);
    if (tag) qs.set('tag', tag);
    if (animal) qs.set('animal', animal);
    if (pets) qs.set('pets', String(pets));
    qs.set('page', String(Math.floor((result.designs.length + extra.length) / result.pageSize)));
    const r = await fetch(`/api/public/search?${qs}`);
    if (r.ok) { const d = await r.json(); setExtra(e => [...e, ...d.designs]); }
  };

  const setFilters = (a: string | null, n: 1 | 2 | null) => {
    const qs = new URLSearchParams();
    if (q) qs.set('q', q);
    if (tag) qs.set('tag', tag);
    if (a) qs.set('animal', a);
    if (n) qs.set('pets', String(n));
    router.replace(`/search?${qs}`, { scroll: false });
  };

  const designs = [...(result?.designs ?? []), ...extra].map(d => ({ id: d.id, description: d.description, publicUrl: d.public_url, breed: d.breeds ? { name: d.breeds.name } : null, pets: d.subject_count ?? 1 }));
  const heading = tag ? `Designs with ${tag}` : q ? `Results for “${q}”` : 'Search designs';

  return (
    <div className="min-h-screen bg-white">
      <UserAwareNavigation />
      <main className="mx-auto max-w-6xl px-5 pb-16 pt-6">
        <h1 className="text-3xl font-bold text-gray-900" style={lifeSavers}>{heading}</h1>
        <form role="search" onSubmit={e => { e.preventDefault(); router.replace(`/search?q=${encodeURIComponent(text.trim())}`); }} className="relative mt-4 max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" aria-hidden />
          <input ref={inputRef} type="search" value={text} onChange={e => setText(e.target.value)} enterKeyHint="search"
            placeholder="Breed, occasion, team or anything…" aria-label="Search designs" maxLength={100}
            className="h-12 w-full rounded-xl border border-gray-300 bg-white pl-10 pr-10 text-base focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200" />
          {text && <button type="button" onClick={() => { setText(''); router.replace('/search'); }} aria-label="Clear search" className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"><X className="h-4 w-4" /></button>}
        </form>

        {!q && !tag && (
          <div className="mt-5">
            <p className="text-sm text-gray-600">Try</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {IDEAS.map(i => <li key={i}><Link href={`/search?q=${encodeURIComponent(i)}`} className="inline-flex h-9 items-center rounded-full border border-gray-300 px-4 text-sm text-gray-800 hover:border-purple-400">{i}</Link></li>)}
            </ul>
            <p className="mt-6 text-sm"><Link href="/collections" className="font-semibold text-purple-700 underline">Browse collections</Link> <span className="text-gray-600">or</span> <Link href="/browse" className="font-semibold text-purple-700 underline">browse by breed</Link></p>
          </div>
        )}

        {result && (result.collections.length > 0 || result.breeds.length > 0) && (
          <div className="mt-5">
            <p className="text-sm text-gray-600">Jump to</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {result.collections.map(c => (
                <li key={c.path}><Link href={`/collections/${c.path}`} className="inline-flex h-9 items-center rounded-full bg-purple-100 px-4 text-sm font-medium text-purple-900 hover:bg-purple-200">{c.name}</Link></li>
              ))}
              {result.breeds.map(b => (
                <li key={b.slug}><Link href={`/browse?type=${b.animal_type === 'cat' ? 'cats' : 'dogs'}&breed=${b.id}`} className="inline-flex h-9 items-center rounded-full bg-gray-100 px-4 text-sm font-medium text-gray-900 hover:bg-gray-200">{b.name}</Link></li>
              ))}
            </ul>
          </div>
        )}

        {(q || tag) && (
          <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5" role="group" aria-label="Show">
            {([[null, 'All'], ['dog', 'Dogs'], ['cat', 'Cats']] as [string | null, string][]).map(([a, label]) => (
              <button key={label} onClick={() => setFilters(a, pets)} aria-pressed={(animal ?? null) === a}
                className={`h-9 rounded-full px-4 text-sm font-semibold ${(animal ?? null) === a ? 'bg-gray-900 text-white' : 'border border-gray-300 bg-white text-gray-800 hover:border-gray-500'}`}>{label}</button>
            ))}
          </div>
          <PetCountFilter value={pets} onChange={n => setFilters(animal, n)} />
          </div>
        )}

        <section className="mt-5" aria-live="polite" aria-busy={loading}>
          {error && <p role="alert" className="text-gray-700">Search didn’t work just now. Please try again.</p>}
          {loading && !result && <GridSkeleton />}
          {result && !loading && (
            <p className="mb-3 text-sm text-gray-600">{result.total} design{result.total === 1 ? '' : 's'}</p>
          )}
          {result && designs.length > 0 && <DesignGrid designs={designs} />}
          {result && !loading && result.total === 0 && (
            <div className="rounded-xl bg-gray-50 p-6 text-gray-700">
              <p>No designs match that yet. Any design can be painted with your pet, so have a look around:</p>
              <p className="mt-2"><Link href="/collections" className="font-semibold text-purple-700 underline">Collections</Link> · <Link href="/browse" className="font-semibold text-purple-700 underline">All designs</Link></p>
            </div>
          )}
          {result && designs.length < result.total && (
            <button onClick={more} className="mx-auto mt-8 flex h-12 w-full max-w-xs items-center justify-center rounded-xl border-2 border-purple-200 font-semibold text-purple-800 hover:border-purple-400">Show more</button>
          )}
        </section>
      </main>
    </div>
  );
}
