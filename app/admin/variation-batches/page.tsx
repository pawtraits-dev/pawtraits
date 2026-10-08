'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Layers, Plus, Play, Pencil, Trash2, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import BreedCoatPicker, { type BreedCoat } from '@/components/admin/BreedCoatPicker';
import OutfitPicker from '@/components/admin/OutfitPicker';
import RunDialog from '@/components/admin/VariationRunDialog';
import { recipeSize } from '@/lib/variations/combos';

type Recipe = { id: string; name: string; description: string | null; breed_coats: BreedCoat[]; outfit_ids: string[]; image_size: string; per_reference: number; last_run_at: string | null; updated_at: string };
type Run = {
  id: string; name: string; status: string; image_size: string; reference_ids: string[]; estimated_cost_usd: number | null; cost_usd: number; created_at: string;
  counts: { total: number; waiting: number; to_review: number; approved: number; rejected: number; failed: number; cancelled: number } | null;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  queued: { label: 'Queued', cls: 'bg-gray-100 text-gray-700' },
  running: { label: 'With Gemini', cls: 'bg-blue-100 text-blue-800' },
  review: { label: 'Ready to review', cls: 'bg-amber-100 text-amber-900' },
  done: { label: 'Done', cls: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-500' },
};
const usd = (v: number | null | undefined) => (v == null ? '–' : v < 1 ? `$${v.toFixed(3)}` : `$${v.toFixed(2)}`);

async function api<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(body?.error || res.statusText), { body });
  return body as T;
}

// ---------------------------------------------------------------------------------------------

function RecipeEditor({ recipe, outfits, onSaved, onCancel }: { recipe: Partial<Recipe> | null; outfits: any[]; onSaved: () => void; onCancel: () => void }) {
  const [name, setName] = useState(recipe?.name ?? '');
  const [description, setDescription] = useState(recipe?.description ?? '');
  const [breedCoats, setBreedCoats] = useState<BreedCoat[]>(recipe?.breed_coats ?? []);
  const [outfitIds, setOutfitIds] = useState<string[]>(recipe?.outfit_ids ?? []);
  const [imageSize, setImageSize] = useState(recipe?.image_size ?? '4K');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const size = recipeSize({ breedCoats, outfitIds });

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const body = JSON.stringify({ name, description, breed_coats: breedCoats, outfit_ids: outfitIds, image_size: imageSize });
      if (recipe?.id) await api(`/api/admin/variation-recipes/${recipe.id}`, { method: 'PUT', body });
      else await api('/api/admin/variation-recipes', { method: 'POST', body });
      onSaved();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="font-medium text-gray-700">Name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Top 100 coats, or NFL + NBA on popular dogs" className="mt-1" />
        </label>
        <label className="text-sm">
          <span className="font-medium text-gray-700">Notes (optional)</span>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" />
        </label>
      </div>
      <BreedCoatPicker selected={breedCoats} onChange={setBreedCoats} />
      <OutfitPicker outfits={outfits} selected={outfitIds} onChange={setOutfitIds} idPrefix="recipe-outfit" />
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border bg-gray-50">
        <p className="text-sm text-gray-800">
          <strong className="tabular-nums">{size.toLocaleString('en-GB')}</strong> image{size === 1 ? '' : 's'} per reference design
          {breedCoats.length > 0 && outfitIds.length > 0 && <span className="text-gray-500"> ({breedCoats.length} breed/coats × {outfitIds.length} outfits: each breed/coat wears each outfit)</span>}
          {breedCoats.length > 0 && outfitIds.length === 0 && <span className="text-gray-500"> (keeps each design’s outfit)</span>}
          {breedCoats.length === 0 && outfitIds.length > 0 && <span className="text-gray-500"> (keeps each design’s pet)</span>}
        </p>
        <div className="inline-flex rounded-lg border bg-white p-1" role="group" aria-label="Image size">
          {['2K', '4K'].map((s) => (
            <button key={s} type="button" aria-pressed={imageSize === s} onClick={() => setImageSize(s)}
              className={`px-3 py-1 text-sm rounded-md ${imageSize === s ? 'bg-purple-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>{s}</button>
          ))}
        </div>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={save} disabled={saving || !name.trim() || size === 0}>{saving ? 'Saving…' : 'Save batch'}</Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

// ---------------------------------------------------------------------------------------------

export default function VariationBatchesPage() {
  const [tab, setTab] = useState<'runs' | 'saved'>('runs');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [outfits, setOutfits] = useState<any[]>([]);
  const [editing, setEditing] = useState<Partial<Recipe> | null>(null);
  const [runFor, setRunFor] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, rn] = await Promise.all([api<Recipe[]>('/api/admin/variation-recipes'), api<Run[]>('/api/admin/variation-runs')]);
      setRecipes(r); setRuns(rn); setError(null);
    } catch (e: any) { setError(e.message); }
  }, []);
  useEffect(() => {
    load();
    fetch('/api/outfits').then((r) => r.json()).then((o) => setOutfits((Array.isArray(o) ? o : []).filter((x: any) => x.is_active))).catch(() => undefined);
  }, [load]);
  const active = runs.some((r) => r.status === 'queued' || r.status === 'running');
  useEffect(() => { if (!active) return; const t = setInterval(load, 30_000); return () => clearInterval(t); }, [active, load]);

  const checkNow = async () => { setChecking(true); try { await api('/api/admin/variation-runs/tick', { method: 'POST' }); await load(); } catch (e: any) { setError(e.message); } finally { setChecking(false); } };
  const remove = async (r: Recipe) => { if (!confirm(`Delete the saved batch “${r.name}”? Runs already made keep their results.`)) return; await api(`/api/admin/variation-recipes/${r.id}`, { method: 'DELETE' }); load(); };

  const outfitName = useMemo(() => new Map(outfits.map((o) => [o.id, o.name])), [outfits]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3"><Layers className="w-8 h-8 text-purple-600" /> Variation Batches</h1>
          <p className="text-gray-600 mt-2">Save combinations once, run them on any design through Gemini Batch (half price), then review the results.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={checkNow} disabled={checking}><RefreshCw className={`w-4 h-4 mr-1 ${checking ? 'animate-spin' : ''}`} /> Check now</Button>
          <Button variant="outline" onClick={() => setEditing({})}><Plus className="w-4 h-4 mr-1" /> New saved batch</Button>
          <Button onClick={() => setRunFor(null)} disabled={!recipes.length}><Play className="w-4 h-4 mr-1" /> Run a batch</Button>
        </div>
      </div>

      {error && <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-lg flex gap-2"><AlertTriangle className="w-5 h-5 shrink-0" />{error}</div>}

      <div className="inline-flex rounded-lg border bg-white p-1" role="tablist">
        {([['runs', `Runs (${runs.length})`], ['saved', `Saved batches (${recipes.length})`]] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`px-4 py-1.5 text-sm rounded-md ${tab === k ? 'bg-purple-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>{label}</button>
        ))}
      </div>

      {tab === 'runs' && (
        <div className="bg-white rounded-lg border overflow-hidden">
          {runs.length === 0 ? (
            <p className="p-8 text-center text-gray-600">No runs yet. Save a batch, then run it on one or more designs.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 border-b">
                  <tr>
                    <th className="text-left font-medium px-4 py-2">Run</th>
                    <th className="text-left font-medium px-2 py-2">Status</th>
                    <th className="text-right font-medium px-2 py-2">Images</th>
                    <th className="text-right font-medium px-2 py-2">Waiting</th>
                    <th className="text-right font-medium px-2 py-2">To review</th>
                    <th className="text-right font-medium px-2 py-2">Approved</th>
                    <th className="text-right font-medium px-2 py-2">Failed</th>
                    <th className="text-right font-medium px-4 py-2">Cost / estimate</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <Link href={`/admin/variation-batches/${r.id}`} className="font-medium text-purple-700 hover:underline">{r.name}</Link>
                        <p className="text-xs text-gray-500">{new Date(r.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {r.reference_ids.length} design{r.reference_ids.length === 1 ? '' : 's'} · {r.image_size}</p>
                      </td>
                      <td className="px-2 py-2"><span className={`rounded-full px-2 py-0.5 text-xs ${STATUS[r.status]?.cls}`}>{STATUS[r.status]?.label ?? r.status}</span></td>
                      <td className="text-right px-2 py-2 tabular-nums">{r.counts?.total ?? 0}</td>
                      <td className="text-right px-2 py-2 tabular-nums">{r.counts?.waiting ?? 0}</td>
                      <td className="text-right px-2 py-2 tabular-nums font-medium">{r.counts?.to_review ?? 0}</td>
                      <td className="text-right px-2 py-2 tabular-nums">{r.counts?.approved ?? 0}</td>
                      <td className="text-right px-2 py-2 tabular-nums">{r.counts?.failed ? <span className="text-red-700">{r.counts.failed}</span> : 0}</td>
                      <td className="text-right px-4 py-2 tabular-nums">{usd(r.cost_usd)} <span className="text-gray-500">/ {usd(r.estimated_cost_usd)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'saved' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {recipes.length === 0 && <p className="text-gray-600">No saved batches yet.</p>}
          {recipes.map((r) => (
            <div key={r.id} className="bg-white rounded-lg border p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{r.name}</h3>
                  {r.description && <p className="text-sm text-gray-600">{r.description}</p>}
                </div>
                <Badge variant="outline">{r.image_size}</Badge>
              </div>
              <p className="text-sm text-gray-700">
                <strong className="tabular-nums">{r.per_reference}</strong> images per design · {r.breed_coats.length} breed/coats{r.outfit_ids.length ? ` × ${r.outfit_ids.length} outfits` : ''}
              </p>
              {r.outfit_ids.length > 0 && <p className="text-xs text-gray-500 line-clamp-2">{r.outfit_ids.map((id) => outfitName.get(id)).filter(Boolean).join(', ')}</p>}
              <p className="text-xs text-gray-500">{r.last_run_at ? `Last run ${new Date(r.last_run_at).toLocaleDateString('en-GB')}` : 'Not run yet'}</p>
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={() => setRunFor(r.id)}><Play className="w-3 h-3 mr-1" /> Run</Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(r)}><Pencil className="w-3 h-3 mr-1" /> Edit</Button>
                <Button size="sm" variant="outline" onClick={() => remove(r)} className="text-red-700"><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? 'Edit saved batch' : 'New saved batch'}</DialogTitle></DialogHeader>
          {editing !== null && <RecipeEditor recipe={editing} outfits={outfits} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); setTab('saved'); load(); }} />}
        </DialogContent>
      </Dialog>

      <RunDialog open={runFor !== undefined} onClose={() => setRunFor(undefined)} recipes={recipes} initialRecipeId={runFor ?? undefined}
        onStarted={(id) => { window.location.href = `/admin/variation-batches/${id}`; }} />
    </div>
  );
}
