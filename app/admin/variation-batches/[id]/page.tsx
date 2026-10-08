'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, RefreshCw, Check, X, Ban, RotateCcw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Item = { id: string; reference_image_id: string; label: string; status: string; preview_url: string | null; preview_thumb_url: string | null; width: number | null; height: number | null; saved_image_id: string | null; error: string | null };
type Data = {
  run: { id: string; name: string; status: string; image_size: string; estimated_cost_usd: number | null; created_at: string; reference_ids: string[] };
  counts: { total: number; waiting: number; to_review: number; approved: number; rejected: number; failed: number; cancelled: number } | null;
  jobs: { id: string; state: string; item_count: number; error: string | null }[];
  cost_usd: number;
  references: { id: string; title: string; thumb: string | null }[];
  items: Item[]; total: number; page: number; size: number; filter: string;
};

const FILTERS = [
  { key: 'review', label: 'To review', count: (c: Data['counts']) => c?.to_review ?? 0 },
  { key: 'waiting', label: 'With Gemini', count: (c: Data['counts']) => c?.waiting ?? 0 },
  { key: 'approved', label: 'Approved', count: (c: Data['counts']) => c?.approved ?? 0 },
  { key: 'rejected', label: 'Rejected', count: (c: Data['counts']) => c?.rejected ?? 0 },
  { key: 'failed', label: 'Failed', count: (c: Data['counts']) => c?.failed ?? 0 },
  { key: 'all', label: 'All', count: (c: Data['counts']) => c?.total ?? 0 },
];
const STATUS_LABEL: Record<string, string> = { queued: 'Queued', running: 'With Gemini', review: 'Ready to review', done: 'Done', cancelled: 'Cancelled' };
const usd = (v: number | null | undefined) => (v == null ? '–' : v < 1 ? `$${v.toFixed(3)}` : `$${v.toFixed(2)}`);

async function api<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || res.statusText);
  return body as T;
}

export default function VariationRunPage() {
  const { id } = useParams<{ id: string }>();
  const [filter, setFilter] = useState('review');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<Data | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<'public' | 'hidden'>('public');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (f = filter, p = page) => {
    try { setData(await api<Data>(`/api/admin/variation-runs/${id}?filter=${f}&page=${p}&size=60`)); setError(null); }
    catch (e: any) { setError(e.message); }
  }, [id, filter, page]);
  useEffect(() => { load(filter, page); setSelected([]); }, [filter, page]); // eslint-disable-line react-hooks/exhaustive-deps
  const running = data?.run.status === 'queued' || data?.run.status === 'running';
  useEffect(() => { if (!running) return; const t = setInterval(() => load(), 30_000); return () => clearInterval(t); }, [running, load]);

  const reviewable = (data?.items ?? []).filter((i) => i.status === 'generated');
  const refTitle = new Map((data?.references ?? []).map((r) => [r.id, r.title]));
  const toggle = (itemId: string) => setSelected((s) => (s.includes(itemId) ? s.filter((x) => x !== itemId) : [...s, itemId]));

  /** Approve in groups of 20 (each group moves images on Cloudinary and creates designs) */
  const approve = async (ids: string[]) => {
    setBusy('approve'); setMessage(null);
    let ok = 0, failed = 0;
    try {
      for (let i = 0; i < ids.length; i += 20) {
        const { results } = await api<{ results: { ok: boolean }[] }>(`/api/admin/variation-runs/${id}/review`, { method: 'POST', body: JSON.stringify({ approve: ids.slice(i, i + 20), visibility }) });
        ok += results.filter((r) => r.ok).length; failed += results.filter((r) => !r.ok).length;
        setMessage(`Saving… ${ok} of ${ids.length}`);
      }
      setMessage(`${ok} saved to the catalogue as ${visibility === 'public' ? 'public' : 'hidden'} designs${failed ? `, ${failed} couldn’t be saved` : ''}.`);
    } catch (e: any) { setError(e.message); } finally { setBusy(null); setSelected([]); load(); }
  };
  /** Every image waiting for review, across pages */
  const approveAll = async () => {
    if (!confirm(`Save all ${data?.counts?.to_review ?? 0} images waiting for review to the catalogue as ${visibility} designs?`)) return;
    setBusy('approve');
    const ids: string[] = [];
    for (let p = 0; ; p++) {
      const d = await api<Data>(`/api/admin/variation-runs/${id}?filter=review&page=${p}&size=200`);
      ids.push(...d.items.map((i) => i.id));
      if (d.items.length < 200) break;
    }
    await approve(ids);
  };
  const reject = async (ids: string[]) => {
    setBusy('reject'); setMessage(null);
    try { const r = await api(`/api/admin/variation-runs/${id}/review`, { method: 'POST', body: JSON.stringify({ reject: ids }) }); setMessage(`${r.rejected} rejected and their previews deleted.`); }
    catch (e: any) { setError(e.message); } finally { setBusy(null); setSelected([]); load(); }
  };
  const retry = async () => {
    setBusy('retry');
    try { const r = await api(`/api/admin/variation-runs/${id}/review`, { method: 'POST', body: JSON.stringify({ retryFailed: true }) }); setMessage(`${r.queued} failed images sent to Gemini again.`); }
    catch (e: any) { setError(e.message); } finally { setBusy(null); load(); }
  };
  const cancel = async () => {
    if (!confirm('Cancel this run? Images not yet made are dropped; ones already made stay for review.')) return;
    setBusy('cancel');
    try { await api(`/api/admin/variation-runs/${id}`, { method: 'DELETE' }); } catch (e: any) { setError(e.message); } finally { setBusy(null); load(); }
  };
  const checkNow = async () => {
    setBusy('check');
    try { await api('/api/admin/variation-runs/tick', { method: 'POST' }); } catch (e: any) { setError(e.message); } finally { setBusy(null); load(); }
  };

  if (!data) return <div className="p-8 text-gray-600">{error ?? 'Loading…'}</div>;
  const c = data.counts;
  const done = (c?.total ?? 0) - (c?.waiting ?? 0);
  const pages = Math.ceil(data.total / data.size);

  return (
    <div className="space-y-5">
      <Link href="/admin/variation-batches" className="inline-flex items-center text-sm text-purple-700 hover:underline"><ArrowLeft className="w-4 h-4 mr-1" /> Variation batches</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{data.run.name}</h1>
          <p className="text-sm text-gray-600">
            {STATUS_LABEL[data.run.status] ?? data.run.status} · {data.run.reference_ids.length} design{data.run.reference_ids.length === 1 ? '' : 's'} · {data.run.image_size} ·
            started {new Date(data.run.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={checkNow} disabled={!!busy}><RefreshCw className={`w-4 h-4 mr-1 ${busy === 'check' ? 'animate-spin' : ''}`} /> Check now</Button>
          {(c?.failed ?? 0) > 0 && <Button variant="outline" onClick={retry} disabled={!!busy}><RotateCcw className="w-4 h-4 mr-1" /> Try {c!.failed} failed again</Button>}
          {running && <Button variant="outline" onClick={cancel} disabled={!!busy} className="text-red-700"><Ban className="w-4 h-4 mr-1" /> Cancel run</Button>}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          ['Images', c?.total ?? 0], ['With Gemini', c?.waiting ?? 0], ['To review', c?.to_review ?? 0], ['Approved', c?.approved ?? 0], ['Cost so far', `${usd(data.cost_usd)} / ${usd(data.run.estimated_cost_usd)} est.`],
        ].map(([label, value]) => (
          <div key={label as string} className="bg-white rounded-lg border p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
            <p className="text-lg font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>
      <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={c?.total ?? 0} aria-valuenow={done} aria-label="Images back from Gemini">
        <div className="h-full bg-purple-600" style={{ width: `${(done / Math.max(c?.total ?? 1, 1)) * 100}%` }} />
      </div>
      {running && <p className="text-xs text-gray-500">Gemini batch jobs usually finish within a few hours (at most 24). This page checks every 30 seconds; images appear under “To review” as each group of ~20 comes back.</p>}

      {message && <div className="rounded-lg border border-green-200 bg-green-50 text-green-900 px-3 py-2 text-sm" aria-live="polite">{message}</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 px-3 py-2 text-sm">{error}</div>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap rounded-lg border bg-white p-1" role="tablist">
          {FILTERS.map((f) => (
            <button key={f.key} role="tab" aria-selected={filter === f.key} onClick={() => { setFilter(f.key); setPage(0); }}
              className={`px-3 py-1.5 text-sm rounded-md ${filter === f.key ? 'bg-purple-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>
              {f.label} <span className="tabular-nums opacity-80">{f.count(c)}</span>
            </button>
          ))}
        </div>
        {filter === 'review' && (c?.to_review ?? 0) > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border bg-white p-1" role="group" aria-label="Save as">
              {(['public', 'hidden'] as const).map((v) => (
                <button key={v} type="button" aria-pressed={visibility === v} onClick={() => setVisibility(v)}
                  className={`px-3 py-1 text-sm rounded-md ${visibility === v ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>Save as {v}</button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => setSelected(selected.length === reviewable.length ? [] : reviewable.map((i) => i.id))}>
              {selected.length === reviewable.length && reviewable.length ? 'Clear selection' : 'Select page'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => reject(selected)} disabled={!selected.length || !!busy}><X className="w-4 h-4 mr-1" /> Reject {selected.length || ''}</Button>
            <Button size="sm" onClick={() => approve(selected)} disabled={!selected.length || !!busy}><Check className="w-4 h-4 mr-1" /> Approve {selected.length || ''}</Button>
            <Button size="sm" onClick={approveAll} disabled={!!busy} className="bg-gradient-to-r from-blue-600 to-purple-600">Approve all {c?.to_review}</Button>
          </div>
        )}
      </div>

      {data.items.length === 0 ? (
        <div className="bg-white border rounded-lg p-8 text-center text-gray-600">
          {filter === 'review' && running ? 'Nothing back yet. Images appear here as Gemini finishes them.' : 'Nothing here.'}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
          {data.items.map((it) => {
            const canSelect = it.status === 'generated';
            const isSel = selected.includes(it.id);
            return (
              <div key={it.id} className={`bg-white rounded-lg border overflow-hidden ${isSel ? 'ring-2 ring-purple-600' : ''}`}>
                <button type="button" disabled={!canSelect} onClick={() => toggle(it.id)} aria-pressed={canSelect ? isSel : undefined}
                  className="relative block w-full aspect-square bg-gray-100" aria-label={canSelect ? `Select ${it.label}` : it.label}>
                  {it.preview_thumb_url
                    ? <img src={it.preview_thumb_url} alt={it.label} loading="lazy" className="w-full h-full object-contain" />
                    : <span className="absolute inset-0 flex items-center justify-center text-xs text-gray-500 p-2 text-center">{it.status === 'failed' ? 'Failed' : it.status === 'cancelled' ? 'Cancelled' : 'Waiting for Gemini'}</span>}
                  {canSelect && <span className={`absolute top-1.5 left-1.5 w-5 h-5 rounded border-2 ${isSel ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white/90 border-gray-400'} flex items-center justify-center text-xs`}>{isSel ? '✓' : ''}</span>}
                  {it.status === 'approved' && <span className="absolute top-1.5 left-1.5 rounded bg-green-600 text-white text-[10px] px-1.5">Saved</span>}
                  {it.status === 'rejected' && <span className="absolute top-1.5 left-1.5 rounded bg-gray-700 text-white text-[10px] px-1.5">Rejected</span>}
                </button>
                <div className="p-2 space-y-0.5">
                  <p className="text-xs font-medium leading-tight">{it.label}</p>
                  <p className="text-[11px] text-gray-500 truncate" title={refTitle.get(it.reference_image_id)}>{refTitle.get(it.reference_image_id)}</p>
                  {it.width && <p className="text-[11px] text-gray-500">{it.width}×{it.height}</p>}
                  {it.error && <p className="text-[11px] text-red-700 line-clamp-3" title={it.error}>{it.error}</p>}
                  {it.preview_url && <a href={it.preview_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-[11px] text-purple-700 hover:underline"><ExternalLink className="w-3 h-3" /> Full size</a>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="tabular-nums">Page {page + 1} of {pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
