'use client';

/**
 * Home page: one seasonal band (only while an occasion with designs is in season) and the
 * four collection tiles (only collections that have designs). Data: /api/public/collections.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { CatalogImage } from '@/components/CloudinaryImageDisplay';
import CollectionCard from '@/components/collections/CollectionCard';

interface C { id: string; kind: string; path: string; depth: number; name: string; description: string | null; designs: number; heroImageId: string | null; inSeason: boolean; details: Record<string, any> }

export default function HomeCollections() {
  const [all, setAll] = useState<C[] | null>(null);
  useEffect(() => {
    fetch('/api/public/collections').then(r => (r.ok ? r.json() : null)).then(d => setAll(d?.collections ?? [])).catch(() => setAll([]));
  }, []);
  if (!all) return null;

  const season = all.find(c => c.kind === 'occasion' && c.depth === 1 && c.inSeason && c.designs > 0);
  const tops = all.filter(c => c.depth === 0 && c.designs > 0);
  if (!season && !tops.length) return null;

  return (
    <>
      {season && (
        <section className="mx-auto max-w-6xl px-5 pt-10" aria-labelledby="season-heading">
          <Link href={`/collections/${season.path}`} className="group flex items-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-r from-purple-700 to-fuchsia-600 p-4 text-white sm:p-6">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-purple-100">In season</p>
              <h2 id="season-heading" className="mt-1 text-2xl font-bold" style={{ fontFamily: 'var(--font-life-savers), cursive' }}>{season.name} Pawtraits</h2>
              <p className="mt-1 text-sm text-purple-50">{season.designs} design{season.designs === 1 ? '' : 's'}, ready for your pet.</p>
              <span className="mt-3 inline-flex h-10 items-center gap-1 rounded-xl bg-white px-4 text-sm font-semibold text-purple-800">See {season.name} designs <ArrowRight className="h-4 w-4" /></span>
            </div>
            {season.heroImageId && (
              <div className="h-32 w-24 flex-none overflow-hidden rounded-xl bg-white/10 sm:h-40 sm:w-32 [&>div]:h-full">
                <CatalogImage imageId={season.heroImageId} alt="" sizes="128px" className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105" />
              </div>
            )}
          </Link>
        </section>
      )}
      {tops.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 pt-10" aria-labelledby="collections-heading">
          <div className="flex items-baseline justify-between">
            <h2 id="collections-heading" className="text-xl font-bold">Collections</h2>
            <Link href="/collections" className="text-sm font-semibold text-purple-700">See all</Link>
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-4">
            {tops.map(c => <li key={c.id}><CollectionCard c={c} /></li>)}
          </ul>
        </section>
      )}
    </>
  );
}
