'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type Segment = 'buyers' | 'previewers' | 'scanners';
type Marketing = 'subscribed' | 'unsubscribed' | 'not asked';

interface Result {
  summary: { total: number; subscribed: number; [k: string]: number | boolean };
  rows: any[];
  total: number;
  truncated: boolean;
  locations: { id: string; name: string }[];
}

const TABS: { key: Segment; label: string }[] = [
  { key: 'buyers', label: 'Buyers' },
  { key: 'previewers', label: 'Preview emails' },
  { key: 'scanners', label: 'Scanners' },
];

const dateFmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
const money = (n: number) => `£${n.toFixed(2)}`;
const plural = (n: number, one: string, many: string) => `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`;

const BADGE: Record<Marketing, { label: string; cls: string }> = {
  subscribed: { label: 'Subscribed', cls: 'bg-green-100 text-green-800' },
  unsubscribed: { label: 'Unsubscribed', cls: 'bg-red-100 text-red-800' },
  'not asked': { label: 'Not asked', cls: 'bg-gray-100 text-gray-700' },
};

function MarketingBadge({ status }: { status: Marketing }) {
  const b = BADGE[status] ?? BADGE['not asked'];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${b.cls}`}>{b.label}</span>;
}

function summaryLine(seg: Segment, r: Result): string {
  const t = r.summary.total, s = r.summary.subscribed;
  if (seg === 'buyers') return `${plural(t, 'buyer', 'buyers')} · ${s.toLocaleString('en-GB')} can be emailed and used for ads`;
  if (seg === 'previewers') return `${plural(t, 'person', 'people')} asked for a preview by email · ${s.toLocaleString('en-GB')} can be emailed and used for ads`;
  const n = (k: string) => Number(r.summary[k] || 0).toLocaleString('en-GB');
  return `${plural(t, 'scanner', 'scanners')} · ${n('leftEmail')} left an email · ${n('madePreview')} made a preview · ${n('scannedOnly')} only scanned`;
}

export default function AudiencesPage() {
  const [tab, setTab] = useState<Segment>('buyers');
  const [location, setLocation] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [includeBought, setIncludeBought] = useState<Record<Segment, boolean>>({ buyers: false, previewers: false, scanners: false });
  const [data, setData] = useState<Partial<Record<Segment, Result>>>({});
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const query = useCallback((seg: Segment, format: 'json' | 'meta_csv') => {
    const p = new URLSearchParams({ segment: seg, format });
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    if (location) p.set('location', location);
    if (includeBought[seg]) p.set('includeBought', '1');
    return `/api/admin/audiences?${p.toString()}`;
  }, [from, to, location, includeBought]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(TABS.map(async t => {
        const res = await fetch(query(t.key, 'json'), { cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'Could not load audiences');
        return [t.key, json as Result] as const;
      }));
      const next = Object.fromEntries(results) as Record<Segment, Result>;
      setData(next);
      if (next.buyers?.locations) setLocations(next.buyers.locations);
    } catch (e: any) {
      setError(e.message || 'Could not load audiences');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { load(); }, [load]);

  const current = data[tab];
  const subscribed = current?.summary.subscribed ?? 0;

  const download = async () => {
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch(query(tab, 'meta_csv'), { cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not download the list');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pawtraits-${tab}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message || 'Could not download the list');
    } finally {
      setDownloading(false);
    }
  };

  const tabCount = useMemo(() => (k: Segment) => (data[k] ? data[k]!.summary.total.toLocaleString('en-GB') : '…'), [data]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audiences</h1>
        <p className="text-sm text-gray-600">Who has bought, who asked for a preview by email, and who scanned a stall QR code.</p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div>
            <label htmlFor="aud-stall" className="block text-sm font-medium text-gray-700">Stall</label>
            <select id="aud-stall" value={location} onChange={e => setLocation(e.target.value)} className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="">All stalls</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="aud-from" className="block text-sm font-medium text-gray-700">From</label>
            <input id="aud-from" type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="aud-to" className="block text-sm font-medium text-gray-700">To</label>
            <input id="aud-to" type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>
          {(from || to || location) && (
            <Button type="button" variant="outline" onClick={() => { setFrom(''); setTo(''); setLocation(''); }}>Clear filters</Button>
          )}
        </CardContent>
      </Card>

      <div role="tablist" aria-label="Audience groups" className="flex flex-wrap gap-2 border-b border-gray-200">
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`aud-tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls="aud-panel"
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
          >
            {t.label} ({tabCount(t.key)})
          </button>
        ))}
      </div>

      <div id="aud-panel" role="tabpanel" aria-labelledby={`aud-tab-${tab}`} className="space-y-4">
        {tab !== 'buyers' && (
          <label className="flex items-center gap-2 text-sm text-gray-800">
            <input type="checkbox" checked={includeBought[tab]} onChange={e => setIncludeBought(s => ({ ...s, [tab]: e.target.checked }))} />
            Include people who have bought
          </label>
        )}

        {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

        {loading && !current && <p className="text-sm text-gray-600" role="status">Loading…</p>}

        {current && (
          <>
            <p className="text-sm font-medium text-gray-900" aria-live="polite">{summaryLine(tab, current)}{loading ? ' (updating…)' : ''}</p>
            {current.truncated && <p className="text-sm text-amber-700">There is more data than we can read at once, so these figures may be a little low. Narrow the dates to see everything.</p>}

            {tab !== 'scanners' ? (
              <div>
                <Button type="button" onClick={download} disabled={subscribed === 0 || downloading}>
                  {downloading ? 'Preparing…' : `Download list for Meta (${subscribed.toLocaleString('en-GB')} ${subscribed === 1 ? 'person' : 'people'})`}
                </Button>
                <p className="mt-1 text-xs text-gray-600">Only people who agreed to hear from us are included.</p>
              </div>
            ) : (
              <p className="rounded-md bg-blue-50 p-3 text-sm text-blue-900">
                Scanners are anonymous until they leave an email, so they can&apos;t be downloaded. In Meta, reach them with a website audience of visitors whose address contains utm_source=stall.
              </p>
            )}

            {current.rows.length === 0 ? (
              <p className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-600">Nobody here yet for these filters.</p>
            ) : (
              <>
                <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
                  {tab === 'buyers' && <BuyersTable rows={current.rows} />}
                  {tab === 'previewers' && <PreviewersTable rows={current.rows} />}
                  {tab === 'scanners' && <ScannersTable rows={current.rows} />}
                </div>
                {current.total > current.rows.length && (
                  <p className="text-xs text-gray-600">Showing the newest {current.rows.length.toLocaleString('en-GB')} of {current.total.toLocaleString('en-GB')}. The download includes everyone.</p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const th = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600';
const td = 'px-3 py-2 text-sm text-gray-900 align-top';

function BuyersTable({ rows }: { rows: any[] }) {
  return (
    <table className="min-w-full divide-y divide-gray-200">
      <caption className="sr-only">Buyers</caption>
      <thead className="bg-gray-50">
        <tr>
          {['Name', 'Email', 'Orders', 'Spent', 'First order', 'Last order', 'Stall', 'Marketing'].map(h => <th key={h} scope="col" className={th}>{h}</th>)}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {rows.map(r => (
          <tr key={r.email}>
            <td className={td}>{r.customerId ? <Link href={`/admin/customers/${r.customerId}`} className="text-blue-700 hover:underline">{r.name || 'View customer'}</Link> : (r.name || '')}</td>
            <td className={td}>{r.email}</td>
            <td className={td}>{r.orders}</td>
            <td className={td}>{money(r.totalSpent)}</td>
            <td className={td}>{dateFmt(r.firstOrderAt)}</td>
            <td className={td}>{dateFmt(r.lastOrderAt)}</td>
            <td className={td}>{r.stalls.join(', ')}</td>
            <td className={td}><MarketingBadge status={r.marketing} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PreviewersTable({ rows }: { rows: any[] }) {
  return (
    <table className="min-w-full divide-y divide-gray-200">
      <caption className="sr-only">People who asked for a preview by email</caption>
      <thead className="bg-gray-50">
        <tr>
          {['Email', 'Previews', 'Last sent', 'Opened', 'Marketing', 'Stall', 'Latest design', 'Bought'].map(h => <th key={h} scope="col" className={th}>{h}</th>)}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {rows.map(r => (
          <tr key={r.email}>
            <td className={td}>{r.email}</td>
            <td className={td}>{r.previews}</td>
            <td className={td}>{dateFmt(r.lastSentAt)}</td>
            <td className={td}>{r.opened ? 'Yes' : 'No'}</td>
            <td className={td}><MarketingBadge status={r.marketing} /></td>
            <td className={td}>{r.stall || ''}</td>
            <td className={td}>
              {r.design && (
                <span className="flex items-center gap-2">
                  {r.design.thumb && /* eslint-disable-next-line @next/next/no-img-element */ <img src={r.design.thumb} alt="" className="h-10 w-10 rounded object-cover" loading="lazy" />}
                  <span>{r.design.title}{r.design.stockRef ? ` (#${r.design.stockRef})` : ''}</span>
                </span>
              )}
            </td>
            <td className={td}>{r.hasBought ? 'Yes' : 'No'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ScannersTable({ rows }: { rows: any[] }) {
  return (
    <table className="min-w-full divide-y divide-gray-200">
      <caption className="sr-only">Stall QR scanners</caption>
      <thead className="bg-gray-50">
        <tr>
          {['Stage', 'First scan', 'Last scan', 'Scans', 'New scans', 'Stall', 'Designs scanned'].map(h => <th key={h} scope="col" className={th}>{h}</th>)}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {rows.map(r => (
          <tr key={r.visitorId}>
            <td className={td}>{r.stage}</td>
            <td className={td}>{dateFmt(r.firstScanAt)}</td>
            <td className={td}>{dateFmt(r.lastScanAt)}</td>
            <td className={td}>{r.scans}</td>
            <td className={td}>{r.newScans}</td>
            <td className={td}>{r.stalls.join(', ')}</td>
            <td className={td}>{r.designs.join(', ')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
