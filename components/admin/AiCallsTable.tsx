'use client';

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, ChevronLeft, RefreshCw } from 'lucide-react';
import { FEATURES, usd, int } from '@/lib/ai/feature-labels';

type Timings = {
  post?: Record<string, number>;
  request?: number; queued?: number; inputs?: number; gemini?: number; save?: number; preview?: number; server_total?: number;
  client?: { submit?: number; waiting?: number; image_load?: number; total?: number };
};
type Call = {
  id: number; created_at: string; feature: string; model: string; is_batch: boolean; image_size: string | null;
  input_tokens: number; cached_input_tokens: number; thinking_tokens: number; output_text_tokens: number; output_image_tokens: number; output_images: number;
  cost_input_usd: number | null; cost_thinking_usd: number | null; cost_output_usd: number | null; cost_usd: number | null;
  success: boolean; error: string | null; duration_ms: number | null;
  image_id: string | null; customer_image_id: string | null; batch_job_id: string | null;
  painting: { timings: Timings | null; preview: string | null; status: string | null } | null;
};
type SortKey = 'when' | 'cost' | 'time' | 'input' | 'thinking' | 'image';
type Filters = { feature: string; model: string; size: string; status: string; batch: string };

const NO_FILTERS: Filters = { feature: '', model: '', size: '', status: '', batch: '' };
const secs = (ms?: number | null) => (ms || ms === 0 ? `${(ms / 1000).toFixed(1)}s` : '–');

/** Steps from tapping "Create" on the phone to the painting on screen */
function stepsOf(t: Timings) {
  const c = t.client;
  const server = [
    { key: 'request', label: 'Server: checks and record', ms: t.request, tone: 'bg-sky-400' },
    { key: 'queued', label: 'Background start', ms: t.queued, tone: 'bg-sky-200' },
    { key: 'inputs', label: 'Fetch design and photos', ms: t.inputs, tone: 'bg-amber-400' },
    { key: 'gemini', label: 'Gemini painting', ms: t.gemini, tone: 'bg-purple-600' },
    { key: 'save', label: 'Save to Cloudinary', ms: t.save, tone: 'bg-emerald-500' },
    ...(t.preview != null ? [{ key: 'preview', label: 'Make watermarked preview', ms: t.preview, tone: 'bg-teal-300' }] : []),
  ];
  if (!c?.total) return { steps: server, total: t.server_total, phone: false };
  const upload = c.submit != null && t.request != null ? Math.max(c.submit - t.request, 0) : undefined;
  // Phone noticed "complete" this long after the server wrote it (status update + polling gap)
  const notice = c.waiting != null && t.request != null && t.server_total != null ? Math.max(c.waiting + t.request - t.server_total, 0) : undefined;
  return {
    steps: [
      { key: 'upload', label: 'Phone: send photo', ms: upload, tone: 'bg-gray-400' },
      ...server,
      { key: 'notice', label: 'Phone: notice it is done', ms: notice, tone: 'bg-rose-400' },
      { key: 'image_load', label: 'Phone: load the preview', ms: c.image_load, tone: 'bg-rose-600' },
    ],
    total: c.total,
    phone: true,
  };
}

function TimingBreakdown({ t }: { t: Timings }) {
  const { steps, total, phone } = stepsOf(t);
  const known = steps.filter((s) => typeof s.ms === 'number' && s.ms > 0) as { key: string; label: string; ms: number; tone: string }[];
  const sum = known.reduce((s, x) => s + x.ms, 0) || 1;
  const gemini = t.gemini ?? 0;
  return (
    <div>
      <p className="text-xs font-medium text-gray-700 mb-1">
        {phone ? 'Tap to painting on screen' : 'Server time (no phone report)'}: <span className="tabular-nums">{secs(total)}</span>
        {gemini > 0 && total ? <span className="text-gray-500"> · {secs(total - gemini)} outside Gemini</span> : null}
      </p>
      <div className="flex h-3 w-full overflow-hidden rounded bg-gray-100" aria-hidden>
        {known.map((s) => <div key={s.key} className={s.tone} style={{ width: `${(s.ms / sum) * 100}%` }} title={`${s.label}: ${secs(s.ms)}`} />)}
      </div>
      <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5 text-xs">
        {steps.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-gray-600"><span className={`inline-block h-2 w-2 rounded-sm ${s.tone}`} />{s.label}</span>
            <span className="tabular-nums text-gray-900">{secs(s.ms)}</span>
          </li>
        ))}
      </ul>
      {t.post && (
        <p className="mt-1 text-[11px] text-gray-500 tabular-nums">
          Server request: {Object.entries(t.post).map(([k, v]) => `${k.replace(/_/g, ' ')} ${secs(v)}`).join(' · ')}
        </p>
      )}
    </div>
  );
}

function SortHeader({ label, k, sort, dir, onSort, align = 'right' }: { label: string; k: SortKey; sort: SortKey; dir: 'asc' | 'desc'; onSort: (k: SortKey) => void; align?: 'left' | 'right' }) {
  const active = sort === k;
  return (
    <th className={`font-medium px-2 py-2 ${align === 'left' ? 'text-left' : 'text-right'}`} aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button onClick={() => onSort(k)} className={`inline-flex items-center gap-1 hover:text-gray-900 ${active ? 'text-gray-900' : ''}`}>
        {label}
        {active ? (dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <span className="w-3" />}
      </button>
    </th>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="flex flex-col text-xs text-gray-500 gap-1">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 rounded-md border bg-white px-2 text-sm text-gray-900">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

/** Admin > AI costs: every call in the period, sortable and filterable, newest first */
export default function AiCallsTable({ days, refreshKey, features, models, modelLabels }: {
  days: number; refreshKey: string; features: string[]; models: string[]; modelLabels: Record<string, string>;
}) {
  const [sort, setSort] = useState<SortKey>('when');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [page, setPage] = useState(0);
  const [per, setPer] = useState(50);
  const [calls, setCalls] = useState<Call[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => { setPage(0); }, [days, filters, sort, dir, per]);

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams({ days: String(days), sort, dir, page: String(page), per: String(per) });
    for (const [k, v] of Object.entries(filters)) if (v) qs.set(k, v);
    setLoading(true);
    fetch(`/api/admin/ai-usage/calls?${qs}`, { cache: 'no-store' })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || r.statusText); return j; })
      .then((j) => { if (!cancelled) { setCalls(j.calls); setTotal(j.total); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load calls'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [days, sort, dir, filters, page, per, refreshKey, tick]);

  const onSort = (k: SortKey) => {
    if (k === sort) setDir(dir === 'asc' ? 'desc' : 'asc');
    else { setSort(k); setDir('desc'); }
  };
  const setFilter = (k: keyof Filters) => (v: string) => setFilters((f) => ({ ...f, [k]: v }));
  const filtered = Object.values(filters).some(Boolean);
  const last = Math.max(Math.ceil(total / per) - 1, 0);
  const label = (m: string) => modelLabels[m] ?? m;

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="px-4 pt-4 pb-3 flex flex-wrap items-end gap-3 border-b">
        <div className="mr-auto">
          <h2 className="font-semibold text-gray-900">Calls</h2>
          <p className="text-xs text-gray-500">Click a column to sort, a row for details. Customer paintings show the full phone-to-screen time when the phone reported it.</p>
        </div>
        <Select label="Feature" value={filters.feature} onChange={setFilter('feature')} options={[['', 'All features'], ...features.map((f) => [f, FEATURES[f] ?? f] as [string, string])]} />
        <Select label="Model" value={filters.model} onChange={setFilter('model')} options={[['', 'All models'], ...models.map((m) => [m, label(m)] as [string, string])]} />
        <Select label="Size" value={filters.size} onChange={setFilter('size')} options={[['', 'Any size'], ['1K', '1K'], ['2K', '2K'], ['4K', '4K'], ['none', 'No image']]} />
        <Select label="Result" value={filters.status} onChange={setFilter('status')} options={[['', 'All'], ['ok', 'Succeeded'], ['failed', 'Failed']]} />
        <Select label="Batch" value={filters.batch} onChange={setFilter('batch')} options={[['', 'All'], ['no', 'Live calls'], ['yes', 'Batch']]} />
        {filtered && <button onClick={() => setFilters(NO_FILTERS)} className="h-9 px-3 text-sm text-purple-700 hover:underline">Clear</button>}
        <button onClick={() => setTick((t) => t + 1)} className="h-9 w-9 grid place-items-center rounded-md border hover:bg-gray-50" aria-label="Refresh calls">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && <p className="px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto">
        <table className={`w-full text-sm ${loading ? 'opacity-60' : ''}`}>
          <thead className="text-xs text-gray-500 border-b">
            <tr>
              <th className="w-8" />
              <SortHeader label="When" k="when" sort={sort} dir={dir} onSort={onSort} align="left" />
              <th className="text-left font-medium px-2 py-2">What</th>
              <th className="text-left font-medium px-2 py-2">Model</th>
              <SortHeader label="Input" k="input" sort={sort} dir={dir} onSort={onSort} />
              <SortHeader label="Thinking" k="thinking" sort={sort} dir={dir} onSort={onSort} />
              <SortHeader label="Image out" k="image" sort={sort} dir={dir} onSort={onSort} />
              <SortHeader label="AI time" k="time" sort={sort} dir={dir} onSort={onSort} />
              <th className="text-right font-medium px-2 py-2" title="Tap to painting on screen, from the phone">Phone</th>
              <SortHeader label="Cost" k="cost" sort={sort} dir={dir} onSort={onSort} />
            </tr>
          </thead>
          <tbody>
            {!loading && calls.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-6 text-center text-gray-500">No calls match.</td></tr>
            )}
            {calls.map((c) => {
              const expanded = open === c.id;
              const t = c.painting?.timings;
              return (
                <Fragment key={c.id}>
                  <tr
                    className={`border-b align-top cursor-pointer hover:bg-gray-50 ${expanded ? 'bg-gray-50' : ''}`}
                    onClick={() => setOpen(expanded ? null : c.id)}
                    aria-expanded={expanded}
                  >
                    <td className="pl-3 py-2 text-gray-400">{expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</td>
                    <td className="px-2 py-2 text-gray-600 whitespace-nowrap tabular-nums">
                      {new Date(c.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="px-2 py-2">
                      {FEATURES[c.feature] ?? c.feature}
                      {c.image_size && <span className="text-gray-500"> · {c.image_size}</span>}
                      {!c.success && <p className="text-xs text-red-700 max-w-xs truncate" title={c.error ?? ''}>Failed: {c.error}</p>}
                    </td>
                    <td className="px-2 py-2 text-gray-600 whitespace-nowrap">{label(c.model)}{c.is_batch ? ' · batch' : ''}</td>
                    <td className="text-right px-2 py-2 tabular-nums">{int(c.input_tokens)}</td>
                    <td className="text-right px-2 py-2 tabular-nums">{int(c.thinking_tokens)}</td>
                    <td className="text-right px-2 py-2 tabular-nums">{int(c.output_image_tokens)}</td>
                    <td className="text-right px-2 py-2 tabular-nums text-gray-600">{secs(c.duration_ms)}</td>
                    <td className="text-right px-2 py-2 tabular-nums text-gray-600">{t?.client?.total ? secs(t.client.total) : '–'}</td>
                    <td className="text-right px-4 py-2 tabular-nums font-medium">{c.cost_usd === null ? 'no price' : usd(Number(c.cost_usd))}</td>
                  </tr>
                  {expanded && (
                    <tr className="border-b bg-gray-50">
                      <td />
                      <td colSpan={9} className="px-2 pb-4 pt-1">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                          <div className="text-xs space-y-1">
                            <p className="font-medium text-gray-700">Cost</p>
                            <p className="tabular-nums text-gray-600">
                              Input {usd(Number(c.cost_input_usd ?? 0))} · Thinking {usd(Number(c.cost_thinking_usd ?? 0))} · Output {usd(Number(c.cost_output_usd ?? 0))}
                            </p>
                            <p className="tabular-nums text-gray-600">
                              Tokens: {int(c.input_tokens)} in{c.cached_input_tokens ? ` (${int(c.cached_input_tokens)} cached)` : ''} · {int(c.thinking_tokens)} thinking · {int(c.output_text_tokens)} text out · {int(c.output_image_tokens)} image out ({c.output_images} image{c.output_images === 1 ? '' : 's'})
                            </p>
                            <p className="text-gray-600">{new Date(c.created_at).toLocaleString('en-GB')}</p>
                            {c.image_id && <p><Link className="text-purple-700 underline" href={`/customise/${c.image_id}`} onClick={(e) => e.stopPropagation()}>Design</Link></p>}
                            {c.painting?.preview && <p><a className="text-purple-700 underline" href={c.painting.preview} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Customer painting</a> <span className="text-gray-500">({c.painting.status})</span></p>}
                            {c.batch_job_id && <p className="text-gray-500">Batch job {c.batch_job_id}</p>}
                            {c.error && <p className="text-red-700 break-words">{c.error}</p>}
                          </div>
                          <div className="lg:col-span-2">
                            {t ? <TimingBreakdown t={t} /> : (
                              <p className="text-xs text-gray-500">{c.customer_image_id ? 'No step timings for this painting (made before timing was added).' : 'Step timings are recorded for customer paintings.'}</p>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-gray-600">
        <span className="tabular-nums">{total ? `${int(page * per + 1)}–${int(Math.min(total, (page + 1) * per))} of ${int(total)}` : '0 calls'}</span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs">
            Per page
            <select value={per} onChange={(e) => setPer(Number(e.target.value))} className="h-8 rounded-md border bg-white px-1 text-sm">
              {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <button onClick={() => setPage((p) => Math.max(p - 1, 0))} disabled={page === 0} className="h-8 w-8 grid place-items-center rounded-md border disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="w-4 h-4" /></button>
          <span className="tabular-nums text-xs">{page + 1} / {last + 1}</span>
          <button onClick={() => setPage((p) => Math.min(p + 1, last))} disabled={page >= last} className="h-8 w-8 grid place-items-center rounded-md border disabled:opacity-40" aria-label="Next page"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
}
