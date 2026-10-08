'use client';

import { useEffect, useState } from 'react';
import { Play, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export type RunRecipe = { id: string; name: string; per_reference: number; image_size: string };
export type Ref = { id: string; title: string; thumb: string | null; breed?: string | null; theme?: string | null; pets?: number; has_prompt?: boolean };

const usd = (v: number | null | undefined) => (v == null ? '–' : v < 1 ? `$${v.toFixed(3)}` : `$${v.toFixed(2)}`);

async function api<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(body?.error || res.statusText), { body });
  return body as T;
}

/**
 * Run a saved variation batch on one or more reference designs: pick the batch and designs,
 * see what will be made (combinations already made for a design are skipped) and the
 * estimate, then start. Used on Admin → Variation batches and from a catalogue design.
 */
export function ReferencePicker({ selected, onChange }: { selected: Ref[]; onChange: (r: Ref[]) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Ref[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      try { setResults(await api<Ref[]>(`/api/admin/variation-runs/references?q=${encodeURIComponent(q)}`)); } catch { setResults([]); } finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  const ids = new Set(selected.map((s) => s.id));
  const toggle = (r: Ref) => onChange(ids.has(r.id) ? selected.filter((s) => s.id !== r.id) : [...selected, r]);
  return (
    <div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {selected.map((r) => (
            <span key={r.id} className="inline-flex items-center gap-1.5 rounded-full border bg-purple-50 pl-1 pr-2 py-0.5 text-xs">
              {r.thumb && <img src={r.thumb} alt="" className="w-5 h-5 rounded-full object-cover" />}
              <span className="max-w-[160px] truncate">{r.title}</span>
              <button type="button" onClick={() => toggle(r)} aria-label={`Remove ${r.title}`}><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      )}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search designs by description or prompt…" className="pl-10 text-sm" />
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-72 overflow-y-auto">
        {loading && results.length === 0 && <p className="col-span-full text-sm text-gray-500 italic">Searching…</p>}
        {results.map((r) => (
          <button key={r.id} type="button" onClick={() => toggle(r)} aria-pressed={ids.has(r.id)} title={r.title}
            className={`relative rounded-lg overflow-hidden border-2 text-left ${ids.has(r.id) ? 'border-purple-600' : 'border-transparent hover:border-gray-300'}`}>
            <div className="aspect-square bg-gray-100">{r.thumb && <img src={r.thumb} alt="" className="w-full h-full object-cover" />}</div>
            <p className="text-[11px] leading-tight p-1 line-clamp-2">{r.title}</p>
            {(r.pets ?? 1) > 1 && <span className="absolute top-1 left-1 rounded bg-black/60 text-white text-[10px] px-1">{r.pets} pets</span>}
            {ids.has(r.id) && <span className="absolute top-1 right-1 rounded-full bg-purple-600 text-white text-[10px] px-1.5">✓</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function RunDialog({ open, onClose, recipes, initialRecipeId, initialRefs, onStarted }: {
  open: boolean; onClose: () => void; recipes: RunRecipe[]; initialRecipeId?: string | null; initialRefs?: Ref[]; onStarted: (runId: string) => void;
}) {
  const [recipeId, setRecipeId] = useState<string>(initialRecipeId ?? '');
  const [refs, setRefs] = useState<Ref[]>(initialRefs ?? []);
  const [planned, setPlanned] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setRecipeId(initialRecipeId ?? recipes[0]?.id ?? ''); setRefs(initialRefs ?? []); setPlanned(null); setError(null); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPlanned(null);
    if (!recipeId || !refs.length) return;
    const t = setTimeout(async () => {
      try { setPlanned(await api('/api/admin/variation-runs', { method: 'POST', body: JSON.stringify({ recipeId, referenceIds: refs.map((r) => r.id), dryRun: true }) })); setError(null); }
      catch (e: any) { setError(e.message); }
    }, 300);
    return () => clearTimeout(t);
  }, [recipeId, refs]);

  const start = async () => {
    setBusy(true); setError(null);
    try {
      const r = await api('/api/admin/variation-runs', { method: 'POST', body: JSON.stringify({ recipeId, referenceIds: refs.map((x) => x.id) }) });
      onStarted(r.run.id);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  const recipe = recipes.find((r) => r.id === recipeId);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Run a saved batch</DialogTitle></DialogHeader>
        <div className="space-y-5">
          <label className="block text-sm">
            <span className="font-medium text-gray-700">Saved batch</span>
            <select value={recipeId} onChange={(e) => setRecipeId(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-white">
              {recipes.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.per_reference} per design · {r.image_size}</option>)}
            </select>
          </label>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Reference designs</p>
            <ReferencePicker selected={refs} onChange={setRefs} />
          </div>
          {planned && (
            <div className="rounded-lg border bg-gray-50 p-3 text-sm space-y-2" aria-live="polite">
              <p>
                <strong className="tabular-nums">{planned.total.toLocaleString('en-GB')}</strong> new image{planned.total === 1 ? '' : 's'} to make
                {' '}· estimated <strong>{usd(planned.estimatedCostUsd)}</strong> at Gemini batch prices ({recipe?.image_size})
              </p>
              <ul className="text-xs text-gray-600 space-y-0.5">
                {planned.references.map((r: any) => (
                  <li key={r.id} className={r.excluded ? 'text-amber-800' : ''}>
                    {r.title}: {r.excluded ? <>skipped: {r.excluded}</> : <>{r.make} to make{r.skipped ? `, ${r.skipped} already made or waiting` : ''}</>}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-500">Results usually arrive within a few hours (at most 24). They come back as previews to approve or reject.</p>
            </div>
          )}
          {error && <p className="text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={start} disabled={busy || !planned || planned.total === 0}>
              <Play className="w-4 h-4 mr-1" /> {busy ? 'Starting…' : `Start ${planned?.total ? planned.total.toLocaleString('en-GB') + ' images' : ''}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

