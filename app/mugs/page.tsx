'use client';

/**
 * Mugs: wraparound catalogue designs (2:1 format, e.g. football, with any team, the pet's name on
 * the shirt and a team motto) → /customise/[id]; and the designed zodiac (and other) mugs from
 * Admin → Mugs → Catalog → /mugs/[slug].
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import UserAwareNavigation from '@/components/UserAwareNavigation';
import { CountryProvider } from '@/lib/country-context';
import { plainText } from '@/lib/text/plain';

interface WrapDesign { id: string; title: string; imageUrl: string; teams: boolean; personalised: boolean }
interface MugEntry { id: string; type: string; slug: string; name: string; sub_heading: string; catalog_image_url: string; animal_type?: string | null }

const lifeSavers = { fontFamily: 'var(--font-life-savers), cursive' };

export default function MugsPage() {
  const [mugs, setMugs] = useState<MugEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<string>('all');
  const [wraps, setWraps] = useState<WrapDesign[]>([]);

  useEffect(() => {
    fetch('/api/mugs/catalog')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Could not load mugs'))))
      .then((d) => setMugs(Array.isArray(d) ? d : []))
      .catch((e) => setError(e.message));
    fetch('/api/public/mug-designs').then((r) => (r.ok ? r.json() : { designs: [] })).then((d) => setWraps(d.designs ?? [])).catch(() => {});
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
            Your pet painted onto an 11oz mug: cheering on your team with their name on the shirt, or in their star sign. Pick a design, add a photo and see it in about a minute.
          </p>

          {wraps.length > 0 && (
            <section className="mt-8" aria-labelledby="wrap-mugs">
              <h2 id="wrap-mugs" className="text-xl font-bold text-gray-900">Wraparound mugs</h2>
              <p className="mt-1 text-sm text-gray-600">The picture goes all the way round the mug. Football fans: pick your team, then your pet&apos;s name and number for the shirt.</p>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {wraps.map((w) => (
                  <li key={w.id}>
                    <Link href={`/customise/${w.id}?src=mugs`} className="group block overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 hover:ring-purple-300">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={w.imageUrl} alt={`${w.title} mug design`} className="aspect-[2/1] w-full object-cover transition-transform group-hover:scale-[1.02]" loading="lazy" />
                      <div className="flex flex-wrap items-center gap-2 p-3">
                        <p className="mr-auto font-semibold text-gray-900">{w.title}</p>
                        {w.teams && <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-800">Any team</span>}
                        {w.personalised && <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-800">Name &amp; number</span>}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

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

          {wraps.length > 0 && (mugs?.length ?? 0) > 0 && <h2 className="mt-10 text-xl font-bold text-gray-900">Star sign mugs</h2>}
          <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
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
