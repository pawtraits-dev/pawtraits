'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type Tab = 'prints' | 'breeds';
type Period = '7' | '30' | '90' | 'all';
type Sort = 'sold' | 'scans' | 'previews' | 'revenue';

const PERIODS: { key: Period; label: string }[] = [
  { key: '7', label: 'Last 7 days' }, { key: '30', label: 'Last 30 days' }, { key: '90', label: 'Last 90 days' }, { key: 'all', label: 'All time' },
];
const SORTS: { key: Sort; label: string }[] = [
  { key: 'sold', label: 'Prints sold' }, { key: 'scans', label: 'Scans' }, { key: 'previews', label: 'Previews made' }, { key: 'revenue', label: 'Revenue' },
];

interface PrintRow {
  id: string; title: string; stockRef: number | null; thumb: string | null; versions: number; unlinked: boolean;
  scans: number; scanners: number; previews: number; emails: number; orders: number; sold: number; revenue: number;
  scanToPreview: number | null; previewToOrder: number | null; change: number | null;
  breeds: { breed: string; scans: number; previews: number; sold: number }[];
}
interface CoatRow { id: string | null; name: string; previews: number; people: number; bought: number; share: number | null }
interface BreedRow { id: string | null; name: string; previews: number; people: number; bought: number; share: number | null; change: number | null; coats: CoatRow[] }
interface Stall { id: string; name: string }
interface PrintsData { rows: PrintRow[]; total: number; truncated: boolean; stallFiltered: boolean; stalls: Stall[] }
interface BreedsData {
  rows: BreedRow[]; truncated: boolean; stalls: Stall[];
  summary: { previews: number; breedKnown: number; coatKnown: number; breedShare: number | null; coatShare: number | null };
  notRecognised: BreedRow & { names: { name: string; count: number }[] };
}

const int = (n: number) => n.toLocaleString('en-GB');
const pct = (v: number | null) => (v === null ? '–' : `${(v * 100).toFixed(1)}%`);
const money = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const th = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600';
const thNum = `${th} text-right`;
const td = 'px-3 py-2 text-sm text-gray-900';
const tdNum = `${td} text-right tabular-nums`;

function Change({ value, pounds }: { value: number | null; pounds?: boolean }) {
  if (value === null) return null;
  const abs = pounds ? money(Math.abs(value)) : int(Math.abs(value));
  const text = value === 0 ? '0' : `${value > 0 ? '+' : '−'}${abs}`;
  return <span className="block text-xs text-gray-500" aria-label={`Change on the previous period: ${text}`}>{text}</span>;
}

export default function PopularityPage() {
  const [tab, setTab] = useState<Tab>('prints');
  const [period, setPeriod] = useState<Period>('30');
  const [location, setLocation] = useState('');
  const [animal, setAnimal] = useState('');
  const [sort, setSort] = useState<Sort>('sold');
  const [prints, setPrints] = useState<PrintsData | null>(null);
  const [breeds, setBreeds] = useState<BreedsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());

  const query = useCallback((format?: 'csv') => {
    const p = new URLSearchParams({ tab, period });
    if (location) p.set('location', location);
    if (animal) p.set('animal', animal);
    if (tab === 'prints') p.set('sort', sort);
    if (format) p.set('format', format);
    return `/api/admin/popularity?${p.toString()}`;
  }, [tab, period, location, animal, sort]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setOpen(new Set());
    fetch(query(), { cache: 'no-store' })
      .then(async res => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'Could not load popularity');
        return json;
      })
      .then(json => { if (!cancelled) (tab === 'prints' ? setPrints(json) : setBreeds(json)); })
      .catch(e => { if (!cancelled) setError(e.message || 'Could not load popularity'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query, tab]);

  const toggle = (id: string) => setOpen(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const download = async () => {
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch(query('csv'), { cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not download the file');
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `pawtraits-popular-${tab}-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) { setError(e.message || 'Could not download the file'); }
    finally { setDownloading(false); }
  };

  const stalls = (tab === 'prints' ? prints?.stalls : breeds?.stalls) ?? prints?.stalls ?? breeds?.stalls ?? [];
  const data = tab === 'prints' ? prints : breeds;
  const sortLabel = SORTS.find(s => s.key === sort)?.label ?? '';

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Popularity</h1>
        <p className="text-sm text-gray-600">Which designs people scan, preview and buy, and which breeds and coats of pet customers actually upload.</p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div>
            <label htmlFor="pop-period" className="block text-sm font-medium text-gray-700">Period</label>
            <select id="pop-period" value={period} onChange={e => setPeriod(e.target.value as Period)} className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm">
              {PERIODS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="pop-stall" className="block text-sm font-medium text-gray-700">Stall</label>
            <select id="pop-stall" value={location} onChange={e => setLocation(e.target.value)} className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm" disabled={tab === 'breeds'}>
              <option value="">All stalls</option>
              {stalls.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="pop-animal" className="block text-sm font-medium text-gray-700">Animal</label>
            <select id="pop-animal" value={animal} onChange={e => setAnimal(e.target.value)} className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="">All</option><option value="dog">Dogs</option><option value="cat">Cats</option>
            </select>
          </div>
          {tab === 'prints' && (
            <div>
              <label htmlFor="pop-sort" className="block text-sm font-medium text-gray-700">Sort by</label>
              <select id="pop-sort" value={sort} onChange={e => setSort(e.target.value as Sort)} className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm">
                {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
          )}
          <Button type="button" variant="outline" onClick={download} disabled={downloading || loading}>{downloading ? 'Preparing…' : 'Download CSV'}</Button>
        </CardContent>
      </Card>

      <div role="tablist" aria-label="Popularity views" className="flex gap-2 border-b border-gray-200">
        {([['prints', 'Prints'], ['breeds', 'Breeds']] as const).map(([k, label]) => (
          <button key={k} type="button" role="tab" id={`pop-tab-${k}`} aria-selected={tab === k} aria-controls="pop-panel" onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === k ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>{label}</button>
        ))}
      </div>

      <div id="pop-panel" role="tabpanel" aria-labelledby={`pop-tab-${tab}`} aria-busy={loading} className="space-y-3">
        {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        {data?.truncated && <p role="status" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">There is more data than can be read at once (20,000 rows in one table), so these figures are incomplete. Try a shorter period.</p>}
        {loading && <p role="status" className="text-sm text-gray-600">Loading…</p>}

        {tab === 'prints' && prints && !loading && (
          <>
            {location && <p className="text-sm text-gray-600">Previews cannot be tied to a stall, so previews made are for all stalls and the two percentages are not shown. Scans, preview emails, orders and sales are for this stall.</p>}
            {animal && <p className="text-sm text-gray-600">Only versions of a design that have a breed are counted when an animal is chosen.</p>}
            <p className="text-sm text-gray-600">{prints.total === 0 ? 'No activity' : `Showing the top ${int(prints.rows.length)} of ${int(prints.total)} designs`}{prints.total > 0 ? `, by ${sortLabel.toLowerCase()}` : ''}. Every breed and coat version counts towards its original design.</p>
            {prints.rows.length === 0 ? <p className="rounded-md border border-gray-200 bg-white p-6 text-sm text-gray-600">Nothing to show for these filters yet.</p> : (
              <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
                <table className="min-w-full divide-y divide-gray-200">
                  <caption className="sr-only">Most popular original designs</caption>
                  <thead className="bg-gray-50"><tr>
                    <th scope="col" className={th}><span className="sr-only">Details</span></th>
                    <th scope="col" className={th}>Design</th>
                    <th scope="col" className={thNum}>Versions</th>
                    <th scope="col" className={thNum}>Scans</th>
                    <th scope="col" className={thNum}>Scanners</th>
                    <th scope="col" className={thNum}>Previews made</th>
                    <th scope="col" className={thNum}>Preview emails</th>
                    <th scope="col" className={thNum}>Orders</th>
                    <th scope="col" className={thNum}>Prints sold</th>
                    <th scope="col" className={thNum}>Revenue</th>
                    <th scope="col" className={thNum}>Scan to preview</th>
                    <th scope="col" className={thNum}>Preview to order</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {prints.rows.map(r => {
                      const isOpen = open.has(r.id);
                      return (
                        <Fragment key={r.id}>
                          <tr>
                            <td className={td}>
                              <button type="button" aria-expanded={isOpen} aria-controls={`pop-breeds-${r.id}`} onClick={() => toggle(r.id)} className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50">
                                {isOpen ? 'Hide breeds' : 'Breeds'}<span className="sr-only"> for {r.title}</span>
                              </button>
                            </td>
                            <td className={td}>
                              <span className="flex items-center gap-2">
                                {r.thumb && /* eslint-disable-next-line @next/next/no-img-element */ <img src={r.thumb} alt="" className="h-10 w-10 rounded object-cover" loading="lazy" />}
                                <span>{r.title}{r.stockRef ? ` (#${r.stockRef})` : ''}{r.unlinked && <span className="block text-xs text-gray-500">Older version, not linked to an original</span>}</span>
                              </span>
                            </td>
                            <td className={tdNum}>{int(r.versions)}</td>
                            <td className={tdNum}>{int(r.scans)}{sort === 'scans' && <Change value={r.change} />}</td>
                            <td className={tdNum}>{int(r.scanners)}</td>
                            <td className={tdNum}>{int(r.previews)}{sort === 'previews' && <Change value={r.change} />}</td>
                            <td className={tdNum}>{int(r.emails)}</td>
                            <td className={tdNum}>{int(r.orders)}</td>
                            <td className={tdNum}>{int(r.sold)}{sort === 'sold' && <Change value={r.change} />}</td>
                            <td className={tdNum}>{money(r.revenue)}{sort === 'revenue' && <Change value={r.change} pounds />}</td>
                            <td className={tdNum}>{pct(r.scanToPreview)}</td>
                            <td className={tdNum}>{pct(r.previewToOrder)}</td>
                          </tr>
                          {isOpen && (
                            <tr id={`pop-breeds-${r.id}`} className="bg-gray-50">
                              <td />
                              <td colSpan={11} className="px-3 py-2">
                                <table className="min-w-[24rem] text-sm">
                                  <caption className="sr-only">Breeds of the versions of {r.title}</caption>
                                  <thead><tr>
                                    <th scope="col" className={th}>Breed of the version</th><th scope="col" className={thNum}>Scans</th><th scope="col" className={thNum}>Previews made</th><th scope="col" className={thNum}>Sold</th>
                                  </tr></thead>
                                  <tbody>{r.breeds.map(b => (
                                    <tr key={b.breed}><td className={td}>{b.breed}</td><td className={tdNum}>{int(b.scans)}</td><td className={tdNum}>{int(b.previews)}</td><td className={tdNum}>{int(b.sold)}</td></tr>
                                  ))}</tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === 'breeds' && breeds && !loading && (
          <>
            {location && <p className="text-sm text-gray-600">The stall filter does not apply here: previews cannot be tied to a stall.</p>}
            <p className="text-sm text-gray-700">
              Breed known for {int(breeds.summary.breedKnown)} of {int(breeds.summary.previews)} previews ({pct(breeds.summary.breedShare)}) · coat known for {int(breeds.summary.coatKnown)} of {int(breeds.summary.previews)} ({pct(breeds.summary.coatShare)})
            </p>
            {breeds.summary.previews === 0 ? <p className="rounded-md border border-gray-200 bg-white p-6 text-sm text-gray-600">No previews for these filters yet.</p> : (
              <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
                <table className="min-w-full divide-y divide-gray-200">
                  <caption className="sr-only">Breeds and coats of pets customers uploaded</caption>
                  <thead className="bg-gray-50"><tr>
                    <th scope="col" className={th}><span className="sr-only">Details</span></th>
                    <th scope="col" className={th}>Breed</th>
                    <th scope="col" className={thNum}>Previews made</th>
                    <th scope="col" className={thNum}>People</th>
                    <th scope="col" className={thNum}>Bought</th>
                    <th scope="col" className={thNum}>Share of previews</th>
                    <th scope="col" className={thNum}>Change</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {[...breeds.rows, { ...breeds.notRecognised, id: 'not-recognised' }].map(b => {
                      const key = b.id ?? 'x';
                      const isOpen = open.has(key);
                      const isNot = key === 'not-recognised';
                      const expandable = isNot ? (breeds.notRecognised.names.length > 0 || b.coats.length > 0) : b.coats.length > 0;
                      return (
                        <Fragment key={key}>
                          <tr className={isNot ? 'bg-gray-50' : undefined}>
                            <td className={td}>
                              {expandable && (
                                <button type="button" aria-expanded={isOpen} aria-controls={`pop-b-${key}`} onClick={() => toggle(key)} className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50">
                                  {isOpen ? 'Hide' : isNot ? 'Names' : 'Coats'}<span className="sr-only"> for {b.name}</span>
                                </button>
                              )}
                            </td>
                            <td className={td}>{b.name}</td>
                            <td className={tdNum}>{int(b.previews)}</td>
                            <td className={tdNum}>{int(b.people)}</td>
                            <td className={tdNum}>{int(b.bought)}</td>
                            <td className={tdNum}>{pct(b.share)}</td>
                            <td className={tdNum}>{b.change === null ? '–' : b.change === 0 ? '0' : `${b.change > 0 ? '+' : '−'}${int(Math.abs(b.change))}`}</td>
                          </tr>
                          {isOpen && (
                            <tr id={`pop-b-${key}`} className="bg-gray-50">
                              <td />
                              <td colSpan={6} className="space-y-3 px-3 py-2">
                                {b.coats.length > 0 && (
                                  <table className="min-w-[28rem] text-sm">
                                    <caption className="sr-only">Coats of {b.name}</caption>
                                    <thead><tr>
                                      <th scope="col" className={th}>Coat</th><th scope="col" className={thNum}>Previews made</th><th scope="col" className={thNum}>People</th><th scope="col" className={thNum}>Bought</th><th scope="col" className={thNum}>Share of this breed</th>
                                    </tr></thead>
                                    <tbody>{b.coats.map(c => (
                                      <tr key={c.id ?? 'none'}><td className={td}>{c.name}</td><td className={tdNum}>{int(c.previews)}</td><td className={tdNum}>{int(c.people)}</td><td className={tdNum}>{int(c.bought)}</td><td className={tdNum}>{pct(c.share)}</td></tr>
                                    ))}</tbody>
                                  </table>
                                )}
                                {isNot && breeds.notRecognised.names.length > 0 && (
                                  <table className="min-w-[20rem] text-sm">
                                    <caption className="sr-only">Breed names the photo check found that are not in the catalogue</caption>
                                    <thead><tr><th scope="col" className={th}>Breed not in the catalogue</th><th scope="col" className={thNum}>Previews</th></tr></thead>
                                    <tbody>{breeds.notRecognised.names.map(n => <tr key={n.name}><td className={td}>{n.name}</td><td className={tdNum}>{int(n.count)}</td></tr>)}</tbody>
                                  </table>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
