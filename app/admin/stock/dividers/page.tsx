'use client';

/**
 * Admin → Stock & Stalls → Divider cards: one card per breed for the flip-through bins, as wide as
 * the prints and 2 cm taller (breed name in the top 2 cm, hero picture, description, QR to the
 * breed's designs). Choose the size and breeds, then preview one card or download them all as a
 * PDF (one card per page, exact size). Data: /api/admin/stock/dividers.
 */
import { useEffect, useMemo, useState } from 'react';
import { Download, Eye, Images, Loader2, X } from 'lucide-react';

interface Breed { id: string; name: string; animal: 'dog' | 'cat'; hero: string | null; designs: number; custom?: boolean }
interface Design { id: string; title: string; at: string; thumb: string | null }

/** Choose the three designs on a breed's card (default: the newest three) */
function DesignChooser({ breed, onClose, onSaved }: { breed: Breed; onClose: () => void; onSaved: (custom: boolean) => void }) {
  const [designs, setDesigns] = useState<Design[] | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetch(`/api/admin/stock/dividers?breed=${breed.id}`, { credentials: 'include' }).then(r => r.json()).then(d => {
      if (d.error) setErr(d.error); else { setDesigns(d.designs); setSel(d.selected); }
    }).catch(() => setErr('Could not load the designs'));
  }, [breed.id]);
  const toggle = (id: string) => setSel(s => (s.includes(id) ? s.filter(x => x !== id) : s.length >= 3 ? s : [...s, id]));
  const save = async (ids: string[]) => {
    setBusy(true); setErr(null);
    const r = await fetch('/api/admin/stock/dividers', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ breedId: breed.id, designIds: ids }) });
    setBusy(false);
    if (!r.ok) { const j = await r.json().catch(() => ({})); setErr(j.error || 'Could not save'); return; }
    onSaved(ids.length > 0); onClose();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={`Designs on the ${breed.name} card`}>
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Designs on the {breed.name} card</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-3 text-sm text-gray-600">Pick three, in the order they appear on the card. Without a choice the card shows the newest three.</p>
        {err && <p role="alert" className="mb-2 text-sm text-red-700">{err}</p>}
        {!designs ? <p className="text-sm text-gray-500">Loading…</p> : designs.length === 0 ? <p className="text-sm text-gray-500">This breed has no public designs yet.</p> : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
            {designs.map(d => {
              const n = sel.indexOf(d.id) + 1;
              return (
                <li key={d.id}>
                  <button onClick={() => toggle(d.id)} aria-pressed={n > 0} title={d.title} className="relative block w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {d.thumb ? <img src={d.thumb} alt={d.title} className={`aspect-[2/3] w-full rounded object-cover ${n ? 'ring-[3px] ring-purple-600' : 'hover:ring-2 hover:ring-purple-300'}`} loading="lazy" /> : <span className="block aspect-[2/3] rounded bg-gray-100" />}
                    {n > 0 && <span className="absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-purple-600 text-xs font-bold text-white">{n}</span>}
                  </button>
                  <p className="mt-0.5 truncate text-[10px] text-gray-600">{d.title}</p>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button disabled={busy} onClick={() => save([])} className="rounded border border-gray-300 px-3 py-1.5 text-sm">Use the newest three</button>
          <button disabled={busy || !sel.length} onClick={() => save(sel)} className="rounded bg-purple-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-40">Save ({sel.length} of 3)</button>
        </div>
      </div>
    </div>
  );
}

export default function DividerCardsPage() {
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [sizes, setSizes] = useState<{ key: string; label: string }[]>([]);
  const [size, setSize] = useState('S');
  const [animal, setAnimal] = useState<'' | 'dog' | 'cat'>('');
  const [withDesigns, setWithDesigns] = useState(true);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [choosing, setChoosing] = useState<Breed | null>(null);

  useEffect(() => {
    fetch('/api/admin/stock/dividers', { credentials: 'include' }).then(r => r.json()).then(d => {
      if (d.error) { setMsg({ ok: false, text: d.error }); return; }
      setBreeds(d.breeds); setSizes(d.sizes);
    }).catch(() => setMsg({ ok: false, text: 'Could not load the breeds' }));
  }, []);

  const shown = useMemo(() => breeds.filter(b => (!animal || b.animal === animal) && (!withDesigns || b.designs > 0)), [breeds, animal, withDesigns]);
  const toggle = (id: string) => setPicked(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const make = async (ids: string[], preview: boolean) => {
    setBusy(preview ? 'Making the preview…' : `Making ${ids.length} card${ids.length === 1 ? '' : 's'}… (about a second each)`); setMsg(null);
    try {
      const r = await fetch('/api/admin/stock/dividers', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ size, breedIds: ids }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || `Failed (${r.status})`); }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      if (preview) window.open(url, '_blank');
      else {
        const a = document.createElement('a'); a.href = url;
        a.download = /filename="([^"]+)"/.exec(r.headers.get('Content-Disposition') || '')?.[1] || 'divider-cards.pdf'; a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 120_000);
      const missing = decodeURIComponent(r.headers.get('X-Missing-Hero') || '');
      setMsg({ ok: true, text: `Done: ${ids.length} card${ids.length === 1 ? '' : 's'}.${missing ? ` No hero picture for: ${missing} (add one in Admin → Breeds).` : ''}` });
    } catch (e: any) { setMsg({ ok: false, text: e.message }); }
    setBusy(null);
  };

  const pickedList = shown.filter(b => picked.has(b.id)).map(b => b.id);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Divider cards</h1>
        <p className="text-sm text-gray-600">One card per breed for the flip-through bins: as wide as the prints and 2 cm taller, so the breed name and QR show above them. Square hero photo with the description beside it, then three of the breed&apos;s designs (the newest, or the ones you choose). One card per page at its exact size, no bleed.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 text-sm">
        <label>Size
          <select value={size} onChange={e => setSize(e.target.value)} className="mt-1 block rounded border border-gray-300 px-2 py-1.5">
            {sizes.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
        <label>Dogs or cats
          <select value={animal} onChange={e => setAnimal(e.target.value as '' | 'dog' | 'cat')} className="mt-1 block rounded border border-gray-300 px-2 py-1.5">
            <option value="">Both</option><option value="dog">Dogs</option><option value="cat">Cats</option>
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2"><input type="checkbox" checked={withDesigns} onChange={e => setWithDesigns(e.target.checked)} /> Only breeds with designs</label>
        <div className="ml-auto flex gap-2">
          <button onClick={() => setPicked(new Set(shown.map(b => b.id)))} className="rounded border border-gray-300 px-3 py-1.5">Select all ({shown.length})</button>
          <button onClick={() => setPicked(new Set())} className="rounded border border-gray-300 px-3 py-1.5">Clear</button>
          <button disabled={!!busy || !pickedList.length} onClick={() => make(pickedList, false)} className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 font-semibold text-white hover:bg-purple-700 disabled:opacity-40">
            <Download className="h-4 w-4" /> Download {pickedList.length || ''} card{pickedList.length === 1 ? '' : 's'} (PDF)
          </button>
        </div>
      </div>

      {busy && <p role="status" className="flex items-center gap-2 text-sm text-gray-800"><Loader2 className="h-4 w-4 animate-spin" /> {busy}</p>}
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-700'}`}>{msg.text}</p>}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {shown.map(b => {
          const on = picked.has(b.id);
          return (
            <li key={b.id} className={`overflow-hidden rounded-lg border-2 bg-white ${on ? 'border-purple-600' : 'border-gray-200'}`}>
              <button onClick={() => toggle(b.id)} aria-pressed={on} className="block w-full text-left">
                <div className="bg-[#3D2373] px-2 py-1 text-center text-sm font-semibold text-white">{b.name}</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {b.hero ? <img src={b.hero} alt="" className="aspect-square w-full object-cover" loading="lazy" /> : <div className="flex aspect-square items-center justify-center bg-purple-50 text-xs text-purple-700">No hero picture</div>}
              </button>
              <div className="flex items-center justify-between px-2 py-1 text-xs text-gray-600">
                <button onClick={() => setChoosing(b)} className="inline-flex items-center gap-1 hover:text-purple-700" title="Choose the designs on this card">
                  <Images className="h-3 w-3" /> {b.custom ? 'Chosen' : 'Newest'} ({b.designs})
                </button>
                <button disabled={!!busy} onClick={() => make([b.id], true)} className="inline-flex items-center gap-1 text-purple-700 hover:underline disabled:opacity-40"><Eye className="h-3 w-3" /> Preview</button>
              </div>
            </li>
          );
        })}
      </ul>
      {choosing && <DesignChooser breed={choosing} onClose={() => setChoosing(null)} onSaved={(custom) => setBreeds(bs => bs.map(x => (x.id === choosing.id ? { ...x, custom } : x)))} />}
    </div>
  );
}
