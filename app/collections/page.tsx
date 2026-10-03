'use client';

/**
 * /collections — the places to browse besides breed (docs/specs/collections-plan.md, phase 3):
 * Occasions (in season first), Sports leagues, 16 Pawsonalities, Zodiac signs.
 * Data: /api/public/collections.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Search } from 'lucide-react';
import UserAwareNavigation from '@/components/UserAwareNavigation';
import { CountryProvider } from '@/lib/country-context';
import CollectionCard, { type CardCollection } from '@/components/collections/CollectionCard';

interface C extends CardCollection { id: string; kind: string; parentPath: string | null; depth: number; description: string | null }
const lifeSavers = { fontFamily: 'var(--font-life-savers), cursive' };

export default function CollectionsPage() {
  return <CountryProvider><CollectionsContent /></CountryProvider>;
}

function CollectionsContent() {
  const [all, setAll] = useState<C[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch('/api/public/collections').then(r => (r.ok ? r.json() : Promise.reject())).then(d => setAll(d.collections)).catch(() => setError(true));
  }, []);

  const tops = (all ?? []).filter(c => c.depth === 0 && c.designs > 0);
  const childrenOf = (path: string) => (all ?? []).filter(c => c.parentPath === path && c.designs > 0);

  return (
    <div className="min-h-screen bg-white">
      <UserAwareNavigation />
      <main className="mx-auto max-w-6xl px-5 pb-16 pt-6">
        <h1 className="text-3xl font-bold text-gray-900" style={lifeSavers}>Collections</h1>
        <p className="mt-1 text-gray-700">Occasions, your team, your pet’s Pawsonality or star sign. Every design can be painted with your pet.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/search" className="inline-flex h-10 items-center gap-2 rounded-full border border-gray-300 px-4 text-sm font-medium text-gray-800 hover:border-gray-500"><Search className="h-4 w-4" /> Search designs</Link>
          <Link href="/browse" className="inline-flex h-10 items-center gap-2 rounded-full border border-gray-300 px-4 text-sm font-medium text-gray-800 hover:border-gray-500">Browse by breed</Link>
        </div>

        {error && <p role="alert" className="mt-8 text-gray-700">Collections didn’t load. Please refresh the page.</p>}
        {!all && !error && (
          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4" aria-hidden>
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[4/5] animate-pulse rounded-xl bg-gray-100" />)}
          </div>
        )}
        {all && tops.length === 0 && <p className="mt-8 text-gray-700">Collections are coming soon. In the meantime, <Link href="/browse" className="font-semibold text-purple-700 underline">browse by breed</Link>.</p>}

        {tops.map(top => {
          const kids = childrenOf(top.path);
          return (
            <section key={top.id} className="mt-10" aria-labelledby={`h-${top.id}`}>
              <div className="flex items-baseline justify-between gap-3">
                <h2 id={`h-${top.id}`} className="text-xl font-bold text-gray-900">{top.name}</h2>
                <Link href={`/collections/${top.path}`} className="flex shrink-0 items-center gap-1 text-sm font-semibold text-purple-700">All {top.designs} <ArrowRight className="h-4 w-4" /></Link>
              </div>
              {top.description && <p className="mt-0.5 text-sm text-gray-600">{top.description}</p>}
              {top.kind === 'pawsonality' && (
                <p className="mt-1 text-sm"><Link href="/quiz/pawsonality?src=collections" className="font-semibold text-purple-700 underline">Take the free 2-minute quiz</Link> <span className="text-gray-600">to find your pet’s type.</span></p>
              )}
              <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {kids.slice(0, top.kind === 'occasion' ? 12 : 6).map(c => <li key={c.id}><CollectionCard c={c} size="sm" /></li>)}
              </ul>
            </section>
          );
        })}
      </main>
    </div>
  );
}
