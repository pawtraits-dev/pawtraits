'use client';

/**
 * Admin > Customisations: every customer customisation, plus what's popular and what converts.
 * Analytics tab: totals, a daily chart, and tables by design, pet breed and source (bought and
 * share rates are of finished customisations). All tab: the customisations themselves, filterable.
 */
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { RefreshCw, ScanSearch, ShoppingBag, Share2, Star, Wand2 } from 'lucide-react';

type Row = {
  id: string; name: string; customisations: number; completed: number; failed: number; purchased: number; orders: number;
  revenue: number; shared: number; shares: number; views: number; people: number; conversion: number; shareRate: number;
  rating: number | null; ratingCount: number; thumb?: string | null; designBreed?: string | null; theme?: string | null; animal?: string | null; title?: string;
};
type Analytics = {
  days: number; currency: string; otherRevenue: Record<string, number>;
  totals: Row; daily: { date: string; customisations: number; purchased: number; shared: number }[];
  breedCoverage: { profile: number; detected: number; unmatched: number; unknown: number };
  unmatchedBreeds: { name: string; count: number }[];
  designs: Row[]; breeds: Row[]; sources: Row[];
};
type Item = {
  id: string; createdAt: string; status: string; error: string | null; who: string; isGuest: boolean; petName: string | null;
  petPhoto: string; result: string | null; design: { id: string; title: string; thumb: string | null } | null;
  breed: string | null; breedSource: string; source: string | null; rating: number | null;
  purchased: boolean; revenue: Record<string, number>; shared: boolean; shares: number; views: number;
};

const PERIODS = [{ v: 7, l: '7 days' }, { v: 30, l: '30 days' }, { v: 90, l: '90 days' }, { v: 0, l: 'All time' }];
const pct = (v: number) => `${(v * 100).toFixed(v > 0 && v < 0.1 ? 1 : 0)}%`;
const int = (v: number) => Math.round(v).toLocaleString('en-GB');
const SYMBOL: Record<string, string> = { GBP: '£', USD: '$', EUR: '€', AUD: 'A$', CAD: 'C$' };
const money = (minor: number, cur = 'GBP') => `${SYMBOL[cur] ?? cur + ' '}${(minor / 100).toLocaleString('en-GB', { minimumFractionDigits: minor % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
/** A Cloudinary picture, shrunk for the grid */
const shrink = (url: string | null, w = 360) => (url && url.includes('/image/upload/') ? url.replace('/image/upload/', `/image/upload/c_limit,w_${w},f_auto,q_auto/`) : url);
const SOURCE_LABEL: Record<string, string> = {
  direct: 'Direct / browse', unknown: 'Before tracking', share: 'Shared link', qr: 'QR sticker', collection: 'Collection page', collections: 'Collections',
  pawsonalities: 'Pawsonalities page', 'pawsonality-type': 'Pawsonality type page', pawsonality: 'Quiz result', quiz: 'Quiz', design: 'Design page',
};

export default function CustomisationsPage() {
  return <Suspense><Inner /></Suspense>;
}

function Inner() {
  const router = useRouter();
  const sp = useSearchParams();
  const tab = sp.get('tab') === 'all' ? 'all' : 'analytics';
  const go = (params: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(params)) { if (v === null || v === '') next.delete(k); else next.set(k, v); }
    router.replace(`/admin/customisations?${next.toString()}`, { scroll: false });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Wand2 className="h-6 w-6 text-purple-600" /> Customisations</h1>
          <p className="text-sm text-gray-600">Every pet painted into a design: what&apos;s popular, what gets bought and what gets shared.</p>
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
          {[{ k: 'analytics', l: 'Analytics' }, { k: 'all', l: 'All customisations' }].map(t => (
            <button key={t.k} onClick={() => go({ tab: t.k === 'all' ? 'all' : null })}
              className={`rounded-md px-4 py-1.5 text-sm font-medium ${tab === t.k ? 'bg-purple-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}>{t.l}</button>
          ))}
        </div>
      </div>
      {tab === 'analytics' ? <AnalyticsTab go={go} /> : <AllTab go={go} />}
    </div>
  );
}

// ---------------------------------------------------------------------------- analytics

function AnalyticsTab({ go }: { go: (p: Record<string, string | null>) => void }) {
  const sp = useSearchParams();
  const days = sp.get('days') !== null ? Number(sp.get('days')) : 30;
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/admin/customisations/analytics?days=${days}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      setData(json);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, [days]);
  useEffect(() => { load(); }, [load]);

  const t = data?.totals;
  const cur = data?.currency ?? 'GBP';
  const other = data ? Object.entries(data.otherRevenue) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map(p => (
          <button key={p.v} onClick={() => go({ days: p.v === 30 ? null : String(p.v) })}
            className={`rounded-full border px-3 py-1 text-sm ${days === p.v ? 'border-purple-600 bg-purple-50 text-purple-800 font-medium' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>{p.l}</button>
        ))}
        <button onClick={load} className="ml-auto inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
      </div>

      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!data && loading && <div className="h-64 animate-pulse rounded-xl bg-gray-100" />}

      {data && t && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
            <Tile label="Customisations" value={int(t.customisations)} note={`${int(t.people)} people · ${int(t.failed)} failed`} />
            <Tile label="Bought" value={int(t.purchased)} note={`${pct(t.conversion)} of ${int(t.completed)} finished`} />
            <Tile label="Revenue" value={money(t.revenue, cur)} note={other.length ? `+ ${other.map(([c, v]) => money(v, c)).join(', ')}` : `${int(t.orders)} orders`} />
            <Tile label="Shared" value={int(t.shared)} note={`${pct(t.shareRate)} of finished`} />
            <Tile label="Shared-link visits" value={int(t.views)} note={`${int(t.shares)} share taps`} />
            <Tile label="Rating" value={t.rating ? t.rating.toFixed(1) : '–'} note={`${int(t.ratingCount)} rated`} />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-900">Customisations per day</h2>
            <p className="text-xs text-gray-500 mb-2">Bought and shared count against the day the customisation was made.</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.daily} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="#eef0f3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} minTickGap={24} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <Tooltip labelFormatter={d => new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="customisations" name="Customisations" stroke="#7c3aed" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="shared" name="Shared" stroke="#0891b2" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="purchased" name="Bought" stroke="#d97706" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <StatsTable title="By design" rows={data.designs.map(d => ({ ...d, name: d.title ?? d.name }))} currency={cur} kind="design"
            onPick={id => go({ tab: 'all', design: id === 'none' ? null : id, breed: null, source: null })} />

          <div>
            <StatsTable title="By pet breed" rows={data.breeds} currency={cur} kind="breed"
              onPick={id => go({ tab: 'all', breed: id === 'unmatched' ? null : id, design: null, source: null })} />
            <BreedCoverage data={data} onDone={load} />
          </div>

          <StatsTable title="By where they came from" rows={data.sources.map(s => ({ ...s, name: SOURCE_LABEL[s.id] ?? s.id }))} currency={cur} kind="source"
            onPick={id => go({ tab: 'all', source: id === 'unknown' ? null : id, design: null, breed: null })} />
        </>
      )}
    </div>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
      {note && <p className="mt-0.5 text-xs text-gray-500">{note}</p>}
    </div>
  );
}

type SortKey = 'customisations' | 'purchased' | 'conversion' | 'shared' | 'shareRate' | 'views' | 'revenue' | 'rating';
const COLS: { k: SortKey; l: string; title?: string }[] = [
  { k: 'customisations', l: 'Made' },
  { k: 'purchased', l: 'Bought' },
  { k: 'conversion', l: 'Conv.', title: 'Bought ÷ finished customisations' },
  { k: 'revenue', l: 'Revenue' },
  { k: 'shared', l: 'Shared' },
  { k: 'shareRate', l: 'Share rate', title: 'Shared ÷ finished customisations' },
  { k: 'views', l: 'Link visits', title: 'Visits to shared links' },
  { k: 'rating', l: 'Rating' },
];

function StatsTable({ title, rows, currency, kind, onPick }: { title: string; rows: Row[]; currency: string; kind: 'design' | 'breed' | 'source'; onPick: (id: string) => void }) {
  const [sort, setSort] = useState<SortKey>('customisations');
  const [min, setMin] = useState(kind === 'source' ? 1 : 3);
  const [showAll, setShowAll] = useState(false);
  const isRate = sort === 'conversion' || sort === 'shareRate' || sort === 'rating';
  const sorted = useMemo(() => rows
    .filter(r => !isRate || r.completed >= min)
    .slice()
    .sort((a, b) => ((b[sort] ?? -1) as number) - ((a[sort] ?? -1) as number) || b.customisations - a.customisations), [rows, sort, min, isRate]);
  const shown = showAll ? sorted : sorted.slice(0, 15);

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">{title} <span className="font-normal text-gray-500">· {rows.length}</span></h2>
        {isRate && (
          <label className="text-xs text-gray-600">Rates for rows with at least{' '}
            <select value={min} onChange={e => setMin(Number(e.target.value))} className="rounded border border-gray-200 px-1 py-0.5">
              {[1, 3, 5, 10, 25].map(n => <option key={n} value={n}>{n}</option>)}
            </select> finished
          </label>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500">
              <th className="px-4 py-2 font-medium">{kind === 'design' ? 'Design' : kind === 'breed' ? 'Breed' : 'Source'}</th>
              {COLS.map(c => (
                <th key={c.k} className="px-3 py-2 font-medium text-right whitespace-nowrap">
                  <button title={c.title} onClick={() => setSort(c.k)} className={`hover:text-gray-900 ${sort === c.k ? 'text-purple-700 font-semibold' : ''}`}>{c.l}{sort === c.k ? ' ↓' : ''}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map(r => (
              <tr key={r.id} className="border-t border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-2">
                  <button onClick={() => onPick(r.id)} className="flex items-center gap-3 text-left" title="See these customisations">
                    {kind === 'design' && (r.thumb
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={r.thumb} alt="" className="h-12 w-10 rounded object-cover bg-gray-100" loading="lazy" />
                      : <span className="h-12 w-10 rounded bg-gray-100" />)}
                    <span className="min-w-0">
                      <span className="block font-medium text-gray-900 hover:text-purple-700">{r.name}</span>
                      {kind === 'design' && <span className="block text-xs text-gray-500">{[r.designBreed, r.theme].filter(Boolean).join(' · ')}</span>}
                      {kind === 'breed' && r.animal && <span className="block text-xs text-gray-500 capitalize">{r.animal}</span>}
                    </span>
                  </button>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{int(r.customisations)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{int(r.purchased)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.completed ? pct(r.conversion) : '–'}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.revenue ? money(r.revenue, currency) : '–'}</td>
                <td className="px-3 py-2 text-right tabular-nums">{int(r.shared)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.completed ? pct(r.shareRate) : '–'}</td>
                <td className="px-3 py-2 text-right tabular-nums">{int(r.views)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.rating ? `${r.rating.toFixed(1)} (${r.ratingCount})` : '–'}</td>
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={9} className="px-4 py-6 text-center text-gray-500">Nothing in this period{isRate ? ' with enough customisations' : ''}.</td></tr>}
          </tbody>
        </table>
      </div>
      {sorted.length > 15 && (
        <button onClick={() => setShowAll(v => !v)} className="w-full border-t border-gray-100 py-2 text-sm text-purple-700 hover:bg-gray-50">
          {showAll ? 'Show top 15' : `Show all ${sorted.length}`}
        </button>
      )}
    </div>
  );
}

/** How many customisations have a breed, and a button to detect the missing ones */
function BreedCoverage({ data, onDone }: { data: Analytics; onDone: () => void }) {
  const c = data.breedCoverage;
  const [remaining, setRemaining] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/customisations/detect-breeds').then(r => r.json()).then(d => setRemaining(d.remaining ?? null)).catch(() => {});
  }, []);

  async function run() {
    setRunning(true);
    let done = 0, matched = 0;
    try {
      for (let i = 0; i < 100; i++) {
        const res = await fetch('/api/admin/customisations/detect-breeds', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ limit: 20 }) });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Failed');
        done += d.tried; matched += d.matched;
        setRemaining(d.remaining);
        setProgress(`${done} checked, ${matched} matched to a breed`);
        if (!d.tried || !d.remaining) break;
      }
    } catch (e: any) { setProgress(`Stopped: ${e.message}`); }
    setRunning(false);
    onDone();
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-gray-600">
      <span>Breed from the saved pet: <strong>{int(c.profile)}</strong></span>
      <span>Detected from the photo: <strong>{int(c.detected + c.unmatched)}</strong>{c.unmatched ? ` (${int(c.unmatched)} other / mixed)` : ''}</span>
      <span>Not known: <strong>{int(c.unknown)}</strong></span>
      {remaining !== null && remaining > 0 && (
        <button onClick={run} disabled={running} className="inline-flex items-center gap-1 rounded-md border border-purple-200 bg-purple-50 px-2 py-1 font-medium text-purple-800 hover:bg-purple-100 disabled:opacity-60">
          <ScanSearch className={`h-3.5 w-3.5 ${running ? 'animate-pulse' : ''}`} />
          {running ? 'Detecting…' : `Detect breeds for ${int(remaining)} older customisations (about $${(remaining * 0.004).toFixed(2)})`}
        </button>
      )}
      {progress && <span>{progress}</span>}
      {!!data.unmatchedBreeds.length && (
        <span className="basis-full">Detected but not in your breed list: {data.unmatchedBreeds.map(b => `${b.name} (${b.count})`).join(', ')}</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------- all

function AllTab({ go }: { go: (p: Record<string, string | null>) => void }) {
  const sp = useSearchParams();
  const filters = useMemo(() => ({
    status: sp.get('status') || '', purchased: sp.get('purchased') || '', shared: sp.get('shared') || '',
    design: sp.get('design') || '', breed: sp.get('breed') || '', source: sp.get('source') || '', q: sp.get('q') || '',
  }), [sp]);
  const page = Number(sp.get('page')) || 0;
  const [data, setData] = useState<{ total: number; pageSize: number; items: Item[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState(filters.q);

  useEffect(() => {
    const qs = new URLSearchParams({ page: String(page) });
    for (const [k, v] of Object.entries(filters)) if (v) qs.set(k, v);
    setLoading(true); setError(null);
    fetch(`/api/admin/customisations?${qs}`)
      .then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Failed to load'); setData(j); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [filters, page]);

  const set = (k: string, v: string) => go({ [k]: v || null, page: null });
  const pages = data ? Math.ceil(data.total / data.pageSize) : 0;
  const active = Object.entries(filters).filter(([k, v]) => v && (k === 'design' || k === 'breed' || k === 'source'));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={e => { e.preventDefault(); set('q', q.trim()); }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Email or pet name" className="h-9 w-56 rounded-md border border-gray-200 px-3 text-sm" />
        </form>
        <Select value={filters.status} onChange={v => set('status', v)} options={[['', 'Any status'], ['complete', 'Finished'], ['generating', 'Painting'], ['failed', 'Failed']]} />
        <Select value={filters.purchased} onChange={v => set('purchased', v)} options={[['', 'Bought or not'], ['yes', 'Bought']]} />
        <Select value={filters.shared} onChange={v => set('shared', v)} options={[['', 'Shared or not'], ['yes', 'Shared']]} />
        <Select value={filters.breed === 'unknown' ? 'unknown' : ''} onChange={v => set('breed', v)} options={[['', 'Any breed'], ['unknown', 'Breed not known']]} />
        {active.map(([k, v]) => (
          <button key={k} onClick={() => set(k, '')} className="rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-800 hover:bg-purple-100">
            {k === 'source' ? `Source: ${SOURCE_LABEL[v] ?? v}` : k === 'design' ? 'One design' : v === 'unknown' ? 'Breed not known' : 'One breed'} ×
          </button>
        ))}
        <span className="ml-auto text-sm text-gray-600">{data ? `${int(data.total)} customisations` : ''}</span>
      </div>

      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading && !data && <div className="h-64 animate-pulse rounded-xl bg-gray-100" />}

      {data && (
        <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${loading ? 'opacity-60' : ''}`}>
          {data.items.map(it => <ItemCard key={it.id} it={it} />)}
          {!data.items.length && <p className="col-span-full py-10 text-center text-gray-500">No customisations match.</p>}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button disabled={page === 0} onClick={() => go({ page: page - 1 ? String(page - 1) : null })} className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-40">Newer</button>
          <span className="text-sm text-gray-600">Page {page + 1} of {pages}</span>
          <button disabled={page + 1 >= pages} onClick={() => go({ page: String(page + 1) })} className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-40">Older</button>
        </div>
      )}
    </div>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

function ItemCard({ it }: { it: Item }) {
  const revenue = Object.entries(it.revenue).map(([c, v]) => money(v, c)).join(' + ');
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="grid grid-cols-[1fr_2fr] gap-px bg-gray-100">
        <a href={it.petPhoto} target="_blank" rel="noreferrer" className="bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shrink(it.petPhoto, 200) ?? ''} alt="Pet photo" className="h-40 w-full object-cover" loading="lazy" />
        </a>
        {it.result
          ? <a href={it.result} target="_blank" rel="noreferrer" className="bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shrink(it.result) ?? ''} alt="Customisation" className="h-40 w-full object-contain bg-gray-50" loading="lazy" />
            </a>
          : <div className={`grid h-40 place-items-center bg-white text-xs ${it.status === 'failed' ? 'text-red-600' : 'text-gray-400'}`}>
              {it.status === 'failed' ? 'Failed' : 'Painting…'}
            </div>}
      </div>
      <div className="space-y-1.5 p-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-semibold text-gray-900 text-sm">{it.petName && it.petName !== 'Uploaded Pet' ? it.petName : 'Unnamed pet'}</span>
          <span className="shrink-0 text-gray-500">{new Date(it.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <p className="truncate text-gray-600" title={it.who}>{it.isGuest ? 'Guest' : it.who}</p>
        <p className="truncate text-gray-600">
          {it.breed ? <>{it.breed}{it.breedSource === 'detected' || it.breedSource === 'unmatched' ? <span className="text-gray-400"> (detected)</span> : null}</> : <span className="text-gray-400">Breed not known</span>}
        </p>
        {it.design && (
          <Link href={`/customise/${it.design.id}`} target="_blank" className="block truncate text-purple-700 hover:underline" title={it.design.title}>{it.design.title}</Link>
        )}
        <div className="flex flex-wrap gap-1 pt-1">
          {it.purchased && <Badge className="bg-amber-50 text-amber-800"><ShoppingBag className="h-3 w-3" /> Bought{revenue ? ` · ${revenue}` : ''}</Badge>}
          {it.shared && <Badge className="bg-cyan-50 text-cyan-800"><Share2 className="h-3 w-3" /> {it.shares ? `Shared ${it.shares}×` : 'Shared'}{it.views ? ` · ${it.views} visits` : ''}</Badge>}
          {it.rating && <Badge className="bg-gray-100 text-gray-700"><Star className="h-3 w-3" /> {it.rating}</Badge>}
          {it.source && <Badge className="bg-gray-100 text-gray-600">{SOURCE_LABEL[it.source] ?? it.source}</Badge>}
          {it.status === 'failed' && <Badge className="bg-red-50 text-red-700" title={it.error ?? ''}>Failed</Badge>}
        </div>
        <Link href={`/admin/custom-paintings?id=${it.id}`} className="inline-block pt-1 text-gray-500 hover:text-gray-900">Prompt, timings and AI cost →</Link>
      </div>
    </div>
  );
}

function Badge({ children, className, title }: { children: React.ReactNode; className: string; title?: string }) {
  return <span title={title} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${className}`}>{children}</span>;
}
