'use client';

/**
 * A collection page, e.g. /collections/occasions/christmas or /collections/sports/nfl/kansas-city-chiefs
 * (docs/specs/collections-plan.md, phase 3). Breadcrumb, intro, the collections inside it
 * (NFL → teams), designs narrowed by Dogs / Cats or a breed ("Christmas designs for your
 * Cocker Spaniel"), neighbours, and "any design can be your pet". Pawsonality pages link to
 * the quiz; Zodiac finds your pet's sign from their birthday.
 * Data: /api/public/collection.
 */
import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, Sparkles } from 'lucide-react';
import UserAwareNavigation from '@/components/UserAwareNavigation';
import { CountryProvider } from '@/lib/country-context';
import DesignGrid, { GridSkeleton, type GridDesign } from '@/components/collections/DesignGrid';
import { CollectionCircles } from '@/components/collections/CollectionCard';
import ZodiacFinder from '@/components/collections/ZodiacFinder';

const lifeSavers = { fontFamily: 'var(--font-life-savers), cursive' };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const md = (s: string) => { const [m, d] = s.split('-').map(Number); return `${d} ${MONTHS[m - 1]}`; };

interface Node {
  id: string; kind: string; path: string; parentPath: string | null; depth: number; name: string; shortName: string | null;
  description: string | null; designs: number; heroImageId: string | null; inSeason: boolean; seasonal: boolean; details: Record<string, any>;
}
interface PageData {
  collection: Node; breadcrumb: { name: string; path: string }[]; children: Node[]; siblings: Node[];
  breeds: { name: string; slug: string; animalType: 'dog' | 'cat'; designs: number }[];
  filter: { animal: 'dog' | 'cat' | null; breed: { name: string; slug: string } | null };
  designs: GridDesign[]; total: number; page: number; pageSize: number;
}

export default function CollectionPage() {
  return <Suspense fallback={<Shell><div className="mx-auto max-w-6xl px-5 pt-6"><GridSkeleton /></div></Shell>}><CollectionPageContent /></Suspense>;
}

function CollectionPageContent() {
  const params = useParams<{ path: string[] }>();
  const path = (params.path ?? []).join('/');
  const sp = useSearchParams();
  const router = useRouter();
  const animal = sp.get('animal');
  const breed = sp.get('breed');
  const [data, setData] = useState<PageData | null>(null);
  const [more, setMore] = useState<GridDesign[]>([]);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading');
  const [loadingMore, setLoadingMore] = useState(false);

  const query = useCallback((p: number) => {
    const qs = new URLSearchParams({ path });
    if (animal) qs.set('animal', animal);
    if (breed) qs.set('breed', breed);
    if (p) qs.set('page', String(p));
    return `/api/public/collection?${qs}`;
  }, [path, animal, breed]);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading'); setMore([]); setPage(0);
    fetch(query(0)).then(async r => {
      if (cancelled) return;
      if (r.status === 404) { setStatus('missing'); return; }
      if (!r.ok) throw new Error();
      setData(await r.json()); setStatus('ok');
    }).catch(() => !cancelled && setStatus('error'));
    return () => { cancelled = true; };
  }, [query]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const r = await fetch(query(page + 1));
      if (r.ok) { const d = await r.json(); setMore(m => [...m, ...d.designs]); setPage(page + 1); }
    } finally { setLoadingMore(false); }
  };

  const setFilter = (next: { animal?: string | null; breed?: string | null }) => {
    const qs = new URLSearchParams();
    if (next.animal) qs.set('animal', next.animal);
    if (next.breed) qs.set('breed', next.breed);
    router.replace(`/collections/${path}${qs.toString() ? `?${qs}` : ''}`, { scroll: false });
  };

  if (status === 'missing') {
    return (
      <Shell>
        <div className="mx-auto max-w-md px-6 py-16 text-center">
          <h1 className="text-xl font-bold text-gray-900">We couldn’t find that collection</h1>
          <p className="mt-2 text-gray-600">It may have moved. Every design can still be painted with your pet.</p>
          <Link href="/collections" className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-purple-600 px-6 font-semibold text-white">See all collections</Link>
        </div>
      </Shell>
    );
  }
  if (status === 'error') {
    return <Shell><p role="alert" className="mx-auto max-w-md px-6 py-16 text-center text-gray-700">This collection didn’t load. Please refresh the page.</p></Shell>;
  }

  const c = data?.collection;
  const designs = [...(data?.designs ?? []), ...more];
  const animals = new Set((data?.breeds ?? []).map(b => b.animalType));
  const colours: { hex: string; name: string }[] = Array.isArray(c?.details?.colours) ? c!.details.colours : [];
  const forWho = data?.filter.breed ? `for your ${data.filter.breed.name}` : data?.filter.animal === 'cat' ? 'with cats' : data?.filter.animal === 'dog' ? 'with dogs' : null;

  return (
    <Shell>
      <main className="mx-auto max-w-6xl px-5 pb-16 pt-4">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="text-sm text-gray-600">
          <ol className="flex flex-wrap items-center gap-1">
            <li><Link href="/collections" className="hover:text-purple-700 hover:underline">Collections</Link></li>
            {(data?.breadcrumb ?? []).map(b => (
              <li key={b.path} className="flex items-center gap-1"><ChevronRight className="h-3.5 w-3.5" aria-hidden /><Link href={`/collections/${b.path}`} className="hover:text-purple-700 hover:underline">{b.name}</Link></li>
            ))}
          </ol>
        </nav>

        {!c ? <div className="mt-4 h-9 w-2/3 animate-pulse rounded bg-gray-100" /> : (
          <header className="mt-2">
            <h1 className="text-3xl font-bold leading-tight text-gray-900" style={lifeSavers}>
              {c.details?.symbol && <span aria-hidden>{c.details.symbol} </span>}{c.name}
            </h1>
            {colours.length > 0 && (
              <p className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                <span className="flex overflow-hidden rounded border border-gray-300" aria-hidden>{colours.map(k => <span key={k.hex} className="h-4 w-5" style={{ background: k.hex }} />)}</span>
                {colours.map(k => k.name).join(', ')}
              </p>
            )}
            {c.kind === 'zodiac' && c.details?.from && <p className="mt-1 text-gray-700">{md(c.details.from)} to {md(c.details.to)}</p>}
            {c.kind === 'pawsonality' && c.details?.code && (
              <p className="mt-1 text-gray-700">Type {c.details.code}{c.details.cat_name && c.details.cat_name !== c.name ? ` · for cats: ${c.details.cat_name}` : ''}</p>
            )}
            {c.description && <p className="mt-2 max-w-2xl text-gray-700">{c.description}</p>}
            <p className="mt-1 text-sm text-gray-600">{data!.total} design{data!.total === 1 ? '' : 's'}{forWho ? ` ${forWho}` : ''}</p>
          </header>
        )}

        {c?.kind === 'pawsonality' && (
          <Link href="/quiz/pawsonality?src=collection" className="mt-4 flex items-center gap-3 rounded-2xl border border-purple-200 bg-purple-50 p-4 hover:border-purple-400">
            <Sparkles className="h-6 w-6 flex-none text-purple-700" aria-hidden />
            <span><span className="font-semibold text-gray-900">{c.depth === 0 ? 'Which one is your pet?' : `Is your pet ${c.name}?`}</span><br />
              <span className="text-sm text-gray-700">Take the free 2-minute Pawsonality quiz</span></span>
          </Link>
        )}
        {c?.kind === 'zodiac' && c.depth === 0 && (
          <div className="mt-4"><ZodiacFinder available={new Set((data?.children ?? []).map(x => x.path.split('/')[1]))} /></div>
        )}

        {/* Collections inside this one */}
        {(data?.children?.length ?? 0) > 0 && (
          <section className="mt-6" aria-label={`Inside ${c?.name}`}>
            <CollectionCircles items={data!.children} layout={data!.children.length > 8 ? 'wrap' : 'scroll'} showCount label={`Inside ${c?.name}`} />
          </section>
        )}

        {/* Narrow by animal or breed */}
        {data && data.breeds.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {animals.size > 1 && (
              <div className="flex gap-1.5" role="group" aria-label="Show">
                {([[null, 'All'], ['dog', 'Dogs'], ['cat', 'Cats']] as [string | null, string][]).map(([a, label]) => {
                  const on = !data.filter.breed && (data.filter.animal ?? null) === a;
                  return (
                    <button key={label} onClick={() => setFilter({ animal: a })} aria-pressed={on}
                      className={`h-9 rounded-full px-4 text-sm font-semibold ${on ? 'bg-gray-900 text-white' : 'border border-gray-300 bg-white text-gray-800 hover:border-gray-500'}`}>{label}</button>
                  );
                })}
              </div>
            )}
            {data.breeds.length > 1 && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <span className="sr-only">Breed</span>
                <select value={data.filter.breed?.slug ?? ''} onChange={e => setFilter({ breed: e.target.value || null, animal: e.target.value ? null : data.filter.animal })}
                  className="h-9 max-w-[16rem] rounded-full border border-gray-300 bg-white px-3 text-sm">
                  <option value="">Any breed</option>
                  {data.breeds.map(b => <option key={b.slug} value={b.slug}>{b.name} ({b.designs})</option>)}
                </select>
              </label>
            )}
          </div>
        )}

        {/* Designs */}
        <section className="mt-5" aria-label="Designs">
          {status === 'loading' ? <GridSkeleton /> : designs.length === 0 ? (
            <p className="rounded-xl bg-gray-50 p-6 text-gray-700">
              {forWho ? `No ${c?.name} designs ${forWho} yet, but any design can be painted with your pet.` : 'New designs are on the easel.'}{' '}
              {forWho && <button onClick={() => setFilter({})} className="font-semibold text-purple-700 underline">Show all {c?.name} designs</button>}
            </p>
          ) : (
            <>
              <DesignGrid designs={designs} from={path} />
              {designs.length < (data?.total ?? 0) && (
                <button onClick={loadMore} disabled={loadingMore}
                  className="mx-auto mt-8 flex h-12 w-full max-w-xs items-center justify-center rounded-xl border-2 border-purple-200 font-semibold text-purple-800 hover:border-purple-400 disabled:opacity-60">
                  {loadingMore ? 'Loading…' : `Show more (${(data?.total ?? 0) - designs.length})`}
                </button>
              )}
            </>
          )}
        </section>

        {/* Any design can be your pet */}
        <section className="mt-10 rounded-2xl bg-gray-950 p-6 text-white">
          <h2 className="text-xl font-bold" style={lifeSavers}>Any design can be your pet</h2>
          <p className="mt-1 text-gray-300">Pick a design, add a photo, and Pawcasso paints your cat or dog in. Free preview in about a minute.</p>
        </section>

        {/* Neighbours */}
        {(data?.siblings?.length ?? 0) > 0 && (
          <section className="mt-10" aria-labelledby="more-collections">
            <h2 id="more-collections" className="text-lg font-bold text-gray-900">More {data!.breadcrumb[data!.breadcrumb.length - 1]?.name ?? 'collections'}</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {data!.siblings.map(s => (
                <li key={s.id}><Link href={`/collections/${s.path}`} className="inline-flex h-9 items-center rounded-full border border-gray-300 px-3 text-sm text-gray-800 hover:border-purple-400 hover:text-purple-800">{s.shortName || s.name}</Link></li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <CountryProvider>
      <div className="min-h-screen bg-white">
        <UserAwareNavigation />
        {children}
      </div>
    </CountryProvider>
  );
}
