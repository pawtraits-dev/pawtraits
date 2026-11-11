'use client';

/**
 * Admin → Phone Cases → Case art. For a 2:3 design, Gemini extends the background once per
 * layout group (A–E); the original painting is pasted back exactly into its slot. Review each
 * against every model in the group: thin outlines are the cases, red the camera cut-outs. Approve
 * when nothing important sits under a camera. Data: /api/admin/phone-cases/case-art
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Loader2, RefreshCw, Sparkles, X } from 'lucide-react';
import { caseArtLayout, cameraOnCanvas, DEFAULT_PLACEMENT, modelOnCanvas, type CaseArtEntry, type Placement, type PhoneLayoutGroup, type PhoneModel } from '@/lib/phone-cases/geometry';

type Art = CaseArtEntry & { url: string };
interface Design { id: string; title: string; thumb: string | null; aspect: string | null; case_art: Record<string, Art> }
interface Listed { id: string; title: string; thumb: string | null; status: Record<string, string> }

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const STATUS: Record<string, string> = { pending: 'bg-amber-100 text-amber-800', approved: 'bg-green-100 text-green-800', rejected: 'bg-red-100 text-red-800' };

function Overlay({ art, models, camera, proposed }: { art: Art; models: PhoneModel[]; camera: PhoneLayoutGroup['camera']; proposed?: Placement | null }) {
  const L = art.layout;
  const next = proposed ? caseArtLayout(models, proposed).slot : null;
  return (
    <svg viewBox={`0 0 ${L.cw} ${L.ch}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
      <rect x={L.slot.x} y={L.slot.y} width={L.slot.w} height={L.slot.h} fill="none" stroke="#C9A44C" strokeWidth={0.006} strokeDasharray="0.02 0.012" />
      {next && <rect x={next.x} y={next.y} width={next.w} height={next.h} fill="none" stroke="#7C3AED" strokeWidth={0.009} strokeDasharray="0.03 0.015" />}
      {models.map(m => {
        const { case: c } = modelOnCanvas(L, m);
        return (
          <g key={m.id}>
            <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={c.w * 0.14} fill="none" stroke="#fff" strokeWidth={0.008} />
            <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={c.w * 0.14} fill="none" stroke="#111827" strokeWidth={0.004} />
            {cameraOnCanvas(L, m, camera).map((b, i) => <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={b.r} fill="#EF4444" fillOpacity={0.28} stroke="#DC2626" strokeWidth={0.004} />)}
          </g>
        );
      })}
    </svg>
  );
}

export default function CaseArtPage() {
  const [groups, setGroups] = useState<PhoneLayoutGroup[]>([]);
  const [models, setModels] = useState<PhoneModel[]>([]);
  const [listed, setListed] = useState<Listed[] | null>(null);
  const [input, setInput] = useState('');
  const [design, setDesign] = useState<Design | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [overlay, setOverlay] = useState(true);
  const [placement, setPlacement] = useState<Placement>(DEFAULT_PLACEMENT);

  const loadList = useCallback(() => {
    fetch('/api/admin/phone-cases/case-art', { credentials: 'include' }).then(r => r.json()).then(d => (d.error ? setError(d.error) : setListed(d.designs)));
  }, []);
  useEffect(() => {
    fetch('/api/admin/phone-cases', { credentials: 'include' }).then(r => r.json()).then(d => { if (d.error) setError(d.error); else { setGroups(d.groups); setModels(d.models); } });
    loadList();
  }, [loadList]);

  const open = async (id: string) => {
    setError(null); setBusy('load');
    const d = await fetch(`/api/admin/phone-cases/case-art?design=${id}`, { credentials: 'include' }).then(r => r.json()).catch(() => ({ error: 'Could not load the design' }));
    setBusy(null);
    if (d.error) { setError(d.error); return; }
    setDesign(d); setInput(d.id);
    const p = Object.values(d.case_art as Record<string, Art>).find(e => e.layout?.placement)?.layout.placement;
    setPlacement(p ?? DEFAULT_PLACEMENT);
  };

  const generate = async (group: string) => {
    if (!design) return;
    setError(null); setBusy(group);
    const r = await fetch('/api/admin/phone-cases/case-art', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ designId: design.id, group, placement }) });
    const d = await r.json().catch(() => ({ error: 'Case art failed' }));
    setBusy(null);
    if (!r.ok || d.error) { setError(`Layout ${group}: ${d.error || 'failed'}`); return; }
    setDesign(x => x && { ...x, case_art: { ...x.case_art, [group]: d } });
    loadList();
  };

  const setStatus = async (group: string, status: 'approved' | 'rejected') => {
    if (!design) return;
    setBusy(`${group}-status`);
    const r = await fetch('/api/admin/phone-cases/case-art', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ designId: design.id, group, status }) });
    const d = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) { setError(d.error || 'Could not update'); return; }
    setDesign(x => x && { ...x, case_art: { ...x.case_art, [group]: d } });
    loadList();
  };

  const byGroup = useMemo(() => {
    const out: Record<string, PhoneModel[]> = {};
    for (const m of models) (out[m.layout_group] ||= []).push(m);
    return out;
  }, [models]);

  const generateAll = async () => { for (const g of groups) if (!design?.case_art[g.id]) await generate(g.id); };
  const current = design ? Object.values(design.case_art).find(e => e.layout?.placement)?.layout.placement ?? DEFAULT_PLACEMENT : DEFAULT_PLACEMENT;
  const moved = Math.abs(placement.scale - current.scale) > 1e-3 || Math.abs(placement.anchorX - current.anchorX) > 1e-3 || Math.abs(placement.below - current.below) > 1e-3;
  const redoAll = async () => { for (const g of groups) await generate(g.id); };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/phone-cases" className="inline-flex items-center text-sm text-purple-700 hover:underline"><ArrowLeft className="mr-1 h-4 w-4" />Phone cases</Link>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">Case art</h1>
        <p className="mt-1 max-w-3xl text-gray-600">
          Gemini extends a design’s background to the phone shape, once per camera layout. The original painting is then pasted back
          exactly, so the pet never changes. Approve a layout when nothing important sits under a <span className="font-medium text-red-700">camera</span>;
          customers’ own pets go into the same <span className="font-medium text-amber-700">gold</span> slot.
        </p>
      </div>

      <form onSubmit={e => { e.preventDefault(); const id = input.match(UUID)?.[0] ?? input.trim().match(/^#?(\d{1,7})$/)?.[1]; if (id) open(id); else setError('Enter a stock ref (e.g. 1325), a design ID or a link to the design'); }} className="flex flex-wrap gap-2">
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="Stock ref (e.g. 1325), design ID or link" aria-label="Stock ref, design ID or link"
          className="min-w-[18rem] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200" />
        <button className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50" disabled={busy === 'load'}>
          {busy === 'load' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Open design'}
        </button>
      </form>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      {listed && listed.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Designs with case art</h2>
          <ul className="flex flex-wrap gap-3">
            {listed.map(d => (
              <li key={d.id}>
                <button onClick={() => open(d.id)} className={`flex w-44 items-center gap-2 rounded-lg border p-2 text-left hover:border-purple-400 ${design?.id === d.id ? 'border-purple-600 bg-purple-50' : 'border-gray-200 bg-white'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {d.thumb && <img src={d.thumb} alt="" className="h-14 w-10 rounded object-cover" />}
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-gray-900">{d.title}</span>
                    <span className="mt-1 flex flex-wrap gap-0.5">{Object.entries(d.status).sort().map(([g, s]) => <span key={g} className={`rounded px-1 text-[10px] font-semibold ${STATUS[s] || ''}`}>{g}</span>)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {design && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {design.thumb && <img src={design.thumb} alt={design.title} className="h-28 w-auto rounded" />}
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-gray-900">{design.title}</h2>
              <p className="font-mono text-xs text-gray-500">{design.id}</p>
              {design.aspect && design.aspect.replace('/', ':') !== '2:3' && <p className="mt-1 text-sm text-red-700">This design is {design.aspect}: phone cases need a 2:3 portrait design.</p>}
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={overlay} onChange={e => setOverlay(e.target.checked)} className="accent-purple-600" />Show cases and cameras</label>
            <button onClick={generateAll} disabled={!!busy} className="inline-flex items-center rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50">
              <Sparkles className="mr-2 h-4 w-4" />Make all missing layouts
            </button>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="font-semibold text-gray-900">Position of the painting</h3>
            <p className="text-sm text-gray-600">For every phone. Bigger pushes the sides off the case; running the bottom off the case raises the picture without inventing anything. The <span className="font-medium text-purple-700">purple</span> outline shows the new position; redo the layouts to apply it (customers’ pets then go in the same place).</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <label className="text-sm text-gray-700">Size: <b>{Math.round(placement.scale * 100)}%</b>
                <input type="range" min={1} max={1.8} step={0.01} value={placement.scale} onChange={e => setPlacement(p => ({ ...p, scale: Number(e.target.value) }))} className="mt-1 w-full accent-purple-600" />
              </label>
              <label className="text-sm text-gray-700">Keep in view: <b>{placement.anchorX < 0.25 ? 'left side' : placement.anchorX > 0.75 ? 'right side' : 'centre'}</b>
                <input type="range" min={0} max={1} step={0.05} value={placement.anchorX} onChange={e => setPlacement(p => ({ ...p, anchorX: Number(e.target.value) }))} className="mt-1 w-full accent-purple-600" />
              </label>
              <label className="text-sm text-gray-700">Bottom runs off the case: <b>{Math.round(placement.below * 100)}%</b>
                <input type="range" min={0} max={0.6} step={0.01} value={placement.below} onChange={e => setPlacement(p => ({ ...p, below: Number(e.target.value) }))} className="mt-1 w-full accent-purple-600" />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={redoAll} disabled={!!busy || !moved} className="inline-flex items-center rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50">
                <RefreshCw className="mr-2 h-4 w-4" />Redo all layouts in this position
              </button>
              {moved && <button onClick={() => setPlacement(current)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Reset</button>}
              {moved && <span className="self-center text-xs text-amber-700">Redoing replaces the approved art: approve again afterwards.</span>}
            </div>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {groups.map(g => {
              const art = design.case_art[g.id];
              const ms = byGroup[g.id] || [];
              return (
                <li key={g.id} className="rounded-xl border border-gray-200 bg-white p-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-gray-900">Layout {g.id}</h3>
                      <p className="text-xs text-gray-500">{ms.map(m => m.name).join(', ')}</p>
                    </div>
                    {art && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS[art.status]}`}>{art.status}</span>}
                  </div>
                  <div className="relative overflow-hidden rounded-lg bg-gray-100" style={{ aspectRatio: '9 / 16' }}>
                    {busy === g.id ? (
                      <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-gray-500"><Loader2 className="h-6 w-6 animate-spin" />Painting… about a minute</div>
                    ) : art ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <a href={art.url} target="_blank" rel="noreferrer"><img src={art.url} alt={`Layout ${g.id} case art`} className="h-full w-full object-fill" /></a>
                        {overlay && <Overlay art={art} models={ms} camera={g.camera} proposed={moved ? placement : null} />}
                      </>
                    ) : <div className="flex h-full items-center justify-center text-sm text-gray-400">Not made yet</div>}
                  </div>
                  {art?.match != null && (
                    <p className={`mt-2 text-xs ${art.match >= 0.85 ? 'text-gray-600' : 'text-amber-700'}`}>
                      Painting kept in place: {Math.round(art.match * 100)}%{art.match < 0.85 ? ' (Gemini moved it: check the joins, or redo)' : ''}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button onClick={() => generate(g.id)} disabled={!!busy} className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                      {art ? <><RefreshCw className="mr-1 h-3.5 w-3.5" />Redo</> : <><Sparkles className="mr-1 h-3.5 w-3.5" />Make</>}
                    </button>
                    {art && art.status !== 'approved' && (
                      <button onClick={() => setStatus(g.id, 'approved')} disabled={!!busy} className="inline-flex items-center rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"><Check className="mr-1 h-3.5 w-3.5" />Approve</button>
                    )}
                    {art && art.status === 'approved' && (
                      <button onClick={() => setStatus(g.id, 'rejected')} disabled={!!busy} className="inline-flex items-center rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"><X className="mr-1 h-3.5 w-3.5" />Withdraw</button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
