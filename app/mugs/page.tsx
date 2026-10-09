'use client';

/**
 * Mugs: the designed zodiac (and other) mugs from Admin → Mugs → Catalog.
 * Pick one → /mugs/[slug] paints your pet into it.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import UserAwareNavigation from '@/components/UserAwareNavigation';
import { CountryProvider } from '@/lib/country-context';
import { plainText } from '@/lib/text/plain';

interface MugEntry { id: string; type: string; slug: string; name: string; sub_heading: string; catalog_image_url: string; animal_type?: string | null }

const lifeSavers = { fontFamily: 'var(--font-life-savers), cursive' };

export default function MugsPage() {
  const [mugs, setMugs] = useState<MugEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<string>('all');

  useEffect(() => {
    fetch('/api/mugs/catalog')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Could not load mugs'))))
      .then((d) => setMugs(Array.isArray(d) ? d : []))
      .catch((e) => setError(e.message));
  }, []);

  const types = useMemo(() => Array.from(new Set((mugs ?? []).map((m) => m.type))), [mugs]);
  const shown = (mugs ?? []).filter((m) => type === 'all' || m.type === type);

  return (
    <CountryProvider>
      <div className="min-h-[100dvh] bg-gray-50">
        <UserAwareNavigation />
        <main className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
          <h1 className="text-4xl sm:text-5xl text-gray-900" style={lifeSavers}>Pawtrait mugs</h1>
          <p className="mt-3 max-w-2xl text-gray-700">
            Your pet painted into their star sign, with their name, on an 11oz mug in the colour you choose. Pick a design, add a photo and see it in about a minute.
          </p>

          {types.length > 1 && (
            <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Mug type">
              {['all', ...types].map((t) => (
                <button key={t} onClick={() => setType(t)} aria-pressed={type === t}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium ring-1 ${type === t ? 'bg-purple-600 text-white ring-purple-600' : 'bg-white text-gray-700 ring-gray-200'}`}>
                  {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          )}

          {error && <p className="mt-8 text-red-700">{error}</p>}
          {!mugs && !error && <p className="mt-8 text-gray-500">Loading mugs…</p>}
          {mugs && shown.length === 0 && <p className="mt-8 text-gray-600">No mugs here yet.</p>}

          <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {shown.map((m) => (
              <li key={m.id}>
                <Link href={`/mugs/${m.slug}`} className="group block overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 hover:ring-purple-300">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.catalog_image_url.replace('/image/upload/', '/image/upload/c_limit,w_500,f_auto,q_auto/')} alt={`${m.name} mug design`}
                    className="aspect-square w-full object-cover transition-transform group-hover:scale-[1.02]" loading="lazy" />
                  <div className="p-3">
                    <p className="font-semibold text-gray-900">{m.name}</p>
                    <p className="text-sm text-gray-600">{plainText(m.sub_heading)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </main>
      </div>
    </CountryProvider>
  );
}
