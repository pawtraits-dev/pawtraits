'use client';

/**
 * Admin → Quizzes → Breed pictures → "Breed versions in bulk": question pictures (1K) and result
 * type designs (2K) repainted as chosen breeds with the Gemini Batch API (half price, results
 * within 24 h, usually much sooner). Shows the cost before anything starts. Quiz takers who pick
 * a breed then see their own breed on the question cards and on their result.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, RefreshCw, RotateCcw } from 'lucide-react';

type Kind = 'question' | 'type';
interface Data {
  animal: 'dog' | 'cat'; kind: Kind; imageSize: string; perImageUsd: number;
  breeds: { id: string; name: string; rank: number | null }[]; topIds: string[];
  sources: { key: string; label: string; thumb: string | null }[];
  coverage: Record<string, number>;
  runs: { id: string; status: string; item_count: number; estimated_cost_usd: number | null; created_at: string; counts: Record<string, number> }[];
}
interface Plan { make: number; skipped: number; total: number; sources: number; breeds: number; perImageUsd: number; estimatedCostUsd: number; imageSize: string }
interface PreviewItem { key: string; label: string; original: string | null; version: string | null; state: 'done' | 'waiting' | 'failed' | 'missing'; error: string | null }

const usd = (n: number) => `$${n < 1 ? n.toFixed(3) : n.toFixed(2)}`;

export default function BreedBatchPanel({ quizId }: { quizId: string }) {
  const [kind, setKind] = useState<Kind>('question');
  const [top, setTop] = useState(20);
  const [data, setData] = useState<Data | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [starting, setStarting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewBreed, setPreviewBreed] = useState('');
  const [preview, setPreview] = useState<PreviewItem[] | null>(null);
  const planSeq = useRef(0);
  const base = `/api/admin/quizzes/${quizId}/breed-batch`;

  async function load(resetSelection = false) {
    const r = await fetch(`${base}?kind=${kind}&top=${top}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error || 'Could not load'); return; }
    setData(d); setError(null);
    if (resetSelection) setSelected(new Set(d.topIds));
  }
  useEffect(() => { setPlan(null); setConfirming(false); setPreview(null); load(true); }, [quizId, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live plan + cost whenever the selection changes
  useEffect(() => {
    setConfirming(false);
    if (!selected.size) { setPlan(null); return; }
    const seq = ++planSeq.current;
    setPlanning(true);
    const t = setTimeout(async () => {
      const r = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, breedIds: Array.from(selected) }) });
      const d = await r.json().catch(() => ({}));
      if (seq !== planSeq.current) return;
      setPlanning(false);
      if (!r.ok) { setError(d.error || 'Could not work out the cost'); return; }
      setPlan(d);
    }, 400);
    return () => clearTimeout(t);
  }, [selected, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  // While a run is going, refresh progress every 30 s
  const active = data?.runs.some(r => r.status === 'queued' || r.status === 'running');
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => load(), 30_000);
    return () => clearInterval(t);
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  async function start() {
    setStarting(true); setError(null);
    const r = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, breedIds: Array.from(selected), confirm: true }) });
    const d = await r.json().catch(() => ({}));
    setStarting(false); setConfirming(false);
    if (!r.ok) { setError(d.error || 'Could not start'); return; }
    setNotice(d.run ? `Started: ${d.make} pictures, about ${usd(d.estimatedCostUsd)}. They're sent to Gemini within 2 minutes and come back over the next few hours (24 h at most).` : 'Nothing to make: every picture already has these breeds.');
    load(); setPlan(null); setSelected(new Set(selected));
  }

  async function checkNow() {
    setChecking(true);
    const r = await fetch('/api/admin/quizzes/breed-batch/tick', { method: 'POST' });
    const d = await r.json().catch(() => ({}));
    setChecking(false);
    if (!r.ok) setError(d.error || 'Check failed');
    else setNotice(`Checked: ${d.submitted} sent, ${d.checked} checked, ${d.processed + d.partial} with results stored${d.errors?.length ? ` · ${d.errors.length} problem(s)` : ''}.`);
    load();
    if (previewBreed) loadPreview(previewBreed);
  }

  async function cancel(runId: string) {
    await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel', runId }) });
    load();
  }

  async function loadPreview(breedId: string) {
    setPreviewBreed(breedId); setPreview(null);
    if (!breedId) return;
    const r = await fetch(`${base}/preview?kind=${kind}&breedId=${breedId}`);
    const d = await r.json().catch(() => ({}));
    if (r.ok) setPreview(d.items); else setError(d.error || 'Could not load the preview');
  }

  async function redo(sourceKey: string) {
    await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'redo', kind, breedId: previewBreed, sourceKey }) });
    loadPreview(previewBreed); load();
  }

  const shown = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return q ? data.breeds.filter(b => b.name.toLowerCase().includes(q)) : data.breeds;
  }, [data, search]);
  const toggle = (id: string) => setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const per = data?.sources.length ?? 0;

  return (
    <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900">Breed versions in bulk</h3>
          <p className="text-sm text-gray-600 max-w-2xl">
            Repaint the pictures as each breed using the Gemini Batch API (half price). Quiz takers who choose their breed then see it on the question cards and on their result.
          </p>
        </div>
        <button type="button" onClick={checkNow} disabled={checking} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-50">
          {checking ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />} Check now
        </button>
      </div>

      <div className="inline-flex rounded-lg border border-gray-200 p-0.5" role="tablist">
        {([['question', 'Question pictures · 1K'], ['type', 'Result type pictures · 2K']] as [Kind, string][]).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)}
            className={`rounded-md px-3 py-1.5 text-sm ${kind === k ? 'bg-purple-600 font-semibold text-white' : 'text-gray-700 hover:bg-gray-50'}`}>{label}</button>
        ))}
      </div>

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded bg-blue-50 px-3 py-2 text-sm text-blue-900">{notice}</p>}
      {!data && !error && <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading…</p>}

      {data && (
        <>
          <p className="text-sm text-gray-700">
            {per} {kind === 'question' ? 'active question picture' : 'result type design'}{per === 1 ? '' : 's'} can get breed versions
            {kind === 'type' && ' (each type’s main design)'}. About <strong>{usd(data.perImageUsd)}</strong> a picture at {data.imageSize}, batch price.
          </p>
          {per === 0 && <p className="text-sm text-amber-700">{kind === 'question' ? 'Add pictures to the questions first.' : 'Link a main design to the result types first.'}</p>}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-2">
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs text-gray-600">Top breeds
                  <input type="number" min={1} max={300} value={top} onChange={e => setTop(Math.max(1, Math.min(300, Number(e.target.value) || 1)))}
                    className="mt-0.5 block h-9 w-20 rounded-md border px-2 text-sm text-gray-900" />
                </label>
                <button type="button" onClick={() => setSelected(new Set(data.breeds.slice(0, top).map(b => b.id)))} className="h-9 rounded-lg border px-3 text-sm">Select top {top}</button>
                <button type="button" onClick={() => setSelected(new Set())} className="h-9 rounded-lg border px-3 text-sm">Clear</button>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a breed" className="h-9 flex-1 min-w-[140px] rounded-md border px-2 text-sm text-gray-900" />
              </div>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-100">
                <ul className="divide-y divide-gray-50">
                  {shown.map(b => {
                    const have = data.coverage[b.id] ?? 0;
                    return (
                      <li key={b.id}>
                        <label className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-gray-50">
                          <input type="checkbox" checked={selected.has(b.id)} onChange={() => toggle(b.id)} className="h-4 w-4 accent-purple-600" />
                          <span className="w-8 text-xs text-gray-400">{b.rank ?? ''}</span>
                          <span className="flex-1 text-gray-900">{b.name}</span>
                          <span className={`text-xs ${per && have >= per ? 'text-green-700' : have ? 'text-amber-700' : 'text-gray-400'}`}>{have}/{per}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <p className="text-xs text-gray-500">{selected.size} breed{selected.size === 1 ? '' : 's'} selected. The count shows versions made or on their way.</p>
            </div>

            <div className="space-y-3 rounded-lg bg-purple-50/60 p-3 self-start">
              <p className="text-sm font-semibold text-gray-900">Cost estimate</p>
              {!selected.size && <p className="text-sm text-gray-600">Choose breeds to see the cost.</p>}
              {selected.size > 0 && (planning || !plan) && <p className="text-sm text-gray-600 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Working it out…</p>}
              {selected.size > 0 && plan && !planning && (
                <>
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between"><dt className="text-gray-600">Pictures × breeds</dt><dd>{plan.sources} × {plan.breeds} = {plan.total}</dd></div>
                    <div className="flex justify-between"><dt className="text-gray-600">Already made or on their way</dt><dd>{plan.skipped}</dd></div>
                    <div className="flex justify-between"><dt className="text-gray-600">To make</dt><dd className="font-semibold">{plan.make}</dd></div>
                    <div className="flex justify-between"><dt className="text-gray-600">Per picture ({plan.imageSize}, batch)</dt><dd>{usd(plan.perImageUsd)}</dd></div>
                    <div className="flex justify-between border-t border-purple-100 pt-1 text-base"><dt className="font-semibold text-gray-900">Estimated total</dt><dd className="font-bold text-gray-900">{usd(plan.estimatedCostUsd)}</dd></div>
                  </dl>
                  <p className="text-xs text-gray-600">An estimate: actual costs are recorded per picture in AI costs. Results usually arrive within a few hours (24 h at most).</p>
                  {plan.make > 0 && !confirming && (
                    <button type="button" onClick={() => setConfirming(true)} className="w-full rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white">
                      Make {plan.make} picture{plan.make === 1 ? '' : 's'}…
                    </button>
                  )}
                  {confirming && (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-800">Spend about <strong>{usd(plan.estimatedCostUsd)}</strong> on {plan.make} pictures?</p>
                      <div className="flex gap-2">
                        <button type="button" onClick={start} disabled={starting} className="flex-1 rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                          {starting ? 'Starting…' : 'Yes, start'}
                        </button>
                        <button type="button" onClick={() => setConfirming(false)} className="rounded-lg border px-3 py-2 text-sm">Cancel</button>
                      </div>
                    </div>
                  )}
                  {plan.make === 0 && <p className="text-sm text-green-700">Nothing to make: all of these exist or are on their way.</p>}
                </>
              )}
            </div>
          </div>

          {data.runs.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-gray-900">Recent runs</p>
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-gray-500"><tr><th className="py-1">Started</th><th>Progress</th><th>Estimate</th><th>Status</th><th /></tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {data.runs.map(r => {
                    const done = r.counts.done ?? 0, failed = r.counts.failed ?? 0, waiting = (r.counts.queued ?? 0) + (r.counts.submitted ?? 0);
                    return (
                      <tr key={r.id}>
                        <td className="py-1.5 text-gray-700">{new Date(r.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-28 overflow-hidden rounded-full bg-gray-100"><div className="h-1.5 bg-green-500" style={{ width: `${r.item_count ? (done / r.item_count) * 100 : 0}%` }} /></div>
                            <span className="text-xs text-gray-600">{done}/{r.item_count}{failed ? ` · ${failed} failed` : ''}{waiting ? ` · ${waiting} waiting` : ''}</span>
                          </div>
                        </td>
                        <td className="text-gray-700">{r.estimated_cost_usd != null ? usd(Number(r.estimated_cost_usd)) : '—'}</td>
                        <td className="capitalize text-gray-700">{r.status}</td>
                        <td className="text-right">{(r.status === 'queued' || r.status === 'running') && <button type="button" onClick={() => cancel(r.id)} className="text-xs text-red-700 hover:underline">Stop</button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-xs text-gray-500">Failed pictures are made again by the next run for those breeds.</p>
            </div>
          )}

          <div className="space-y-2 border-t border-gray-100 pt-3">
            <label className="text-sm font-semibold text-gray-900">See a breed
              <select value={previewBreed} onChange={e => loadPreview(e.target.value)} className="ml-2 h-9 rounded-md border px-2 text-sm font-normal text-gray-900">
                <option value="">Choose…</option>
                {data.breeds.filter(b => (data.coverage[b.id] ?? 0) > 0).map(b => <option key={b.id} value={b.id}>{b.name} ({data.coverage[b.id]})</option>)}
              </select>
            </label>
            {previewBreed && !preview && <p className="text-sm text-gray-500">Loading…</p>}
            {preview && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {preview.map(p => (
                  <div key={p.key} className="space-y-1 rounded-lg border border-gray-100 p-2">
                    <div className="flex gap-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {p.original && <img src={p.original} alt="Original" className="h-20 w-20 rounded bg-gray-50 object-contain opacity-60" />}
                      {p.version
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={p.version} alt="Breed version" className="h-20 w-20 rounded bg-gray-50 object-contain" />
                        : <span className={`flex h-20 w-20 items-center justify-center rounded bg-gray-50 text-center text-[11px] ${p.state === 'failed' ? 'text-red-700' : 'text-gray-500'}`}>
                            {p.state === 'waiting' ? 'On its way' : p.state === 'failed' ? 'Failed' : 'Not made'}
                          </span>}
                    </div>
                    <p className="line-clamp-2 text-xs text-gray-700" title={p.label}>{p.label.replace(/\[PET_NAME\]/g, 'Your pet')}</p>
                    {p.error && <p className="line-clamp-2 text-[11px] text-red-700" title={p.error}>{p.error}</p>}
                    {p.version && (
                      <button type="button" onClick={() => redo(p.key)} className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-purple-700">
                        <RotateCcw className="h-3 w-3" aria-hidden="true" /> Remake in the next run
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
