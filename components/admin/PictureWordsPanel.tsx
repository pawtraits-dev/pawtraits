'use client';

/**
 * Admin → Catalogue → a design → Words on the picture. Upload a text-free copy, write the words
 * with {pet} where the name or breed goes, choose the font, colour and box (live preview), then
 * draw them on the design and its breed versions. Data: /api/admin/catalog/[id]/words.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Type, Upload } from 'lucide-react';
import { AdminSupabaseService } from '@/lib/admin-supabase';
import { uploadImageDirect } from '@/lib/cloudinary-client';
import { DEFAULT_WORDS, WORD_FONTS, fillWords, wordsLayer, type PictureWords } from '@/lib/picture-words';

type Form = Pick<PictureWords, 'template' | 'font' | 'size' | 'colour' | 'align' | 'lineSpacing' | 'box'>;
interface Info { words: PictureWords | null; phrase: string; current: string | null; cloudName: string; versions: { total: number; ready: number } }

export default function PictureWordsPanel({ imageId, onChanged }: { imageId: string; onChanged?: () => void }) {
  const svc = () => new AdminSupabaseService();
  const [info, setInfo] = useState<Info | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>({ ...DEFAULT_WORDS, box: { ...DEFAULT_WORDS.box } });
  const [sample, setSample] = useState<'breed' | 'name' | 'long'>('breed');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const r = await svc().getPictureWords(imageId);
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
    setInfo(r.data);
    if (r.data.words) { const w = r.data.words; setForm({ template: w.template, font: w.font, size: w.size, colour: w.colour, align: w.align, lineSpacing: w.lineSpacing, box: { ...w.box } }); setOpen(true); }
  }, [imageId]);
  useEffect(() => { setInfo(null); setMsg(null); setOpen(false); load(); }, [load]);

  const clean = info?.words?.clean_public_id ?? null;
  const phrase = sample === 'name' ? 'Biscuit' : sample === 'long' ? 'the Cavalier King Charles Spaniel' : (info?.phrase ?? 'the dog');
  // The preview is redrawn by Cloudinary a moment after changes stop (not on every drag step)
  const [shown, setShown] = useState<Form>(form);
  useEffect(() => { const t = setTimeout(() => setShown(form), 400); return () => clearTimeout(t); }, [form]);
  const preview = useMemo(() => {
    if (!clean || !info) return null;
    const w: PictureWords = { ...shown, aspect: info.words?.aspect ?? null, clean_public_id: clean, original_public_id: null, applied: null };
    return `https://res.cloudinary.com/${info.cloudName}/image/upload/c_limit,w_700/${wordsLayer(w, fillWords(shown.template, phrase))}/f_auto,q_auto/${clean}`;
  }, [clean, info, shown, phrase]);

  const save = async () => {
    setBusy('Saving…'); setMsg(null);
    const r = await svc().savePictureWords(imageId, form);
    setBusy(null);
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return false; }
    await load();
    return true;
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy('Uploading the text-free copy…'); setMsg(null);
    try {
      if (!info?.words) { const ok = await save(); if (!ok) { setBusy(null); return; } setBusy('Uploading the text-free copy…'); }
      const up = await uploadImageDirect(file, { folder: 'pawtraits/clean-copies' } as any);
      const r = await svc().pictureWordsAction(imageId, { action: 'set-clean', public_id: up.public_id, width: up.width, height: up.height });
      if (!r.ok) setMsg({ ok: false, text: r.error });
      await load();
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || 'Upload failed' });
    }
    setBusy(null);
  };

  const apply = async (versions: boolean, adoptClean = false) => {
    if (!(await save())) return;
    setBusy(versions ? 'Drawing the words on the design and its versions…' : 'Drawing the words on the design…');
    const r = await svc().pictureWordsAction(imageId, { action: 'apply', versions, adoptClean });
    setBusy(null);
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
    const v = r.data.versions;
    setMsg({ ok: true, text: `Done: “${r.data.text}”.${v ? ` Versions: ${v.updated} updated${v.failed ? `, ${v.failed} failed` : ''}${v.needsRemake ? `, ${v.needsRemake} without a text-free copy` : ''}.${v.errors?.length ? ` ${v.errors[0]}` : ''}` : ''}` });
    await load();
    onChanged?.();
  };

  const remove = async () => {
    if (!confirm('Remove the words set-up? The design goes back to the picture it had first.')) return;
    setBusy('Removing…');
    const r = await svc().pictureWordsAction(imageId, { action: 'remove' });
    setBusy(null);
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
    setOpen(false); setForm({ ...DEFAULT_WORDS, box: { ...DEFAULT_WORDS.box } });
    await load(); onChanged?.();
  };

  const box = (k: keyof Form['box'], label: string) => (
    <label className="block text-xs text-gray-700">{label} {Math.round(form.box[k] * 100)}%
      <input type="range" min={k === 'w' || k === 'h' ? 3 : 0} max={100} value={Math.round(form.box[k] * 100)}
        onChange={e => setForm(f => ({ ...f, box: { ...f.box, [k]: Number(e.target.value) / 100 } }))} className="block w-full" />
    </label>
  );

  if (!info && !msg) return null;
  return (
    <div className="space-y-3 border-t pt-4">
      <div className="flex items-center gap-2">
        <Type className="h-4 w-4 text-purple-700" />
        <p className="text-sm font-medium">Words on the picture</p>
        {info?.words?.applied && <span className="truncate text-xs text-gray-500">now reads “{info.words.applied.text}”</span>}
      </div>
      {!open && info && !info.words && (
        <button onClick={() => setOpen(true)} className="text-sm text-purple-700 hover:underline">
          This design has words on it: make them personal (the pet&apos;s name or breed)
        </button>
      )}

      {open && info && (
        <>
          <div className="rounded border border-gray-200 bg-gray-50 p-2 text-xs text-gray-700">
            {clean ? 'Text-free copy uploaded.' : '1. Upload a copy of the picture with no words on it (same size and framing).'}
            <label className="ml-2 inline-flex cursor-pointer items-center gap-1 rounded border border-purple-300 bg-white px-2 py-1 font-medium text-purple-800 hover:bg-purple-50">
              <Upload className="h-3 w-3" /> {clean ? 'Replace' : 'Upload'}
              <input type="file" accept="image/*" className="sr-only" disabled={!!busy} onChange={e => upload(e.target.files?.[0])} />
            </label>
          </div>

          <label className="block text-xs font-medium text-gray-700">Words ({'{pet}'} = “the Cocker Spaniel” or their pet&apos;s name; {'{Pet}'} with a capital)
            <textarea value={form.template} onChange={e => setForm(f => ({ ...f, template: e.target.value }))} rows={2}
              className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-gray-700">Font
              <select value={form.font} onChange={e => setForm(f => ({ ...f, font: e.target.value }))} className="mt-1 block w-full rounded border border-gray-300 px-1 py-1 text-sm">
                {WORD_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
            <label className="text-xs text-gray-700">Colour
              <input type="color" value={`#${form.colour}`} onChange={e => setForm(f => ({ ...f, colour: e.target.value.replace('#', '') }))} className="mt-1 block h-8 w-full rounded border border-gray-300" />
            </label>
            <label className="text-xs text-gray-700">Letter size {form.size}
              <input type="range" min={40} max={250} value={form.size} onChange={e => setForm(f => ({ ...f, size: Number(e.target.value) }))} className="block w-full" />
            </label>
            <label className="text-xs text-gray-700">Line spacing {form.lineSpacing}
              <input type="range" min={-60} max={60} value={form.lineSpacing} onChange={e => setForm(f => ({ ...f, lineSpacing: Number(e.target.value) }))} className="block w-full" />
            </label>
            {box('x', 'Box left')}{box('y', 'Box top')}{box('w', 'Box width')}{box('h', 'Box height')}
          </div>

          {preview ? (
            <div>
              <div className="mb-1 flex gap-1 text-xs">
                {(['breed', 'name', 'long'] as const).map(s => (
                  <button key={s} onClick={() => setSample(s)} className={`rounded-full border px-2 py-0.5 ${sample === s ? 'border-purple-600 bg-purple-600 text-white' : 'border-gray-300 text-gray-700'}`}>
                    {s === 'breed' ? info.phrase : s === 'name' ? 'Biscuit' : 'Long breed'}
                  </button>
                ))}
              </div>
              <BoxEditor src={preview} box={form.box} onChange={b => setForm(f => ({ ...f, box: b }))} />
              <p className="mt-1 text-[11px] text-gray-500">Drag the dashed box to move it; drag a corner to resize. The words wrap inside it and get smaller if they don&apos;t fit. The box isn&apos;t printed.</p>
            </div>
          ) : <p className="text-xs text-gray-500">The preview appears once the text-free copy is uploaded.</p>}

          <div className="flex flex-wrap gap-2">
            <button disabled={!!busy} onClick={save} className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50">Save</button>
            <button disabled={!!busy || !clean} onClick={() => apply(false)} className="rounded bg-purple-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50">Draw on the design</button>
            {info.versions.total > 0 && (
              <button disabled={!!busy || !clean} onClick={() => apply(true)} className="rounded border border-purple-300 px-3 py-1.5 text-sm font-semibold text-purple-800 hover:bg-purple-50 disabled:opacity-50">
                …and its {info.versions.total} versions ({info.versions.ready} ready)
              </button>
            )}
            {info.versions.total > info.versions.ready && (
              <button disabled={!!busy || !clean} onClick={() => { if (confirm(`Draw the words on the ${info.versions.total - info.versions.ready} versions that don't have them yet? Only do this if those versions have no words painted in (made from the text-free picture); otherwise the words will be doubled.`)) apply(true, true); }}
                className="rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50">
                Add words to {info.versions.total - info.versions.ready} versions without them
              </button>
            )}
            {info.words && <button disabled={!!busy} onClick={remove} className="text-sm text-gray-500 hover:underline">Remove</button>}
          </div>
          <p className="text-[11px] text-gray-500">Breed versions made from now on are painted from the text-free copy and get their own breed&apos;s words. Short breed names (“Cavalier”) come from Admin → Breeds.</p>
        </>
      )}
      {busy && <p role="status" className="text-sm text-gray-800">{busy}</p>}
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-700'}`}>{msg.text}</p>}
    </div>
  );
}

type Box = PictureWords['box'];
type Mode = 'move' | 'nw' | 'ne' | 'sw' | 'se';

/** The preview with the words' box drawn over it: drag to move, drag a corner to resize */
function BoxEditor({ src, box, onChange }: { src: string; box: Box; onChange: (b: Box) => void }) {
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: Mode; x: number; y: number; start: Box } | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); }, [src]);

  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const round = (v: number) => Math.round(v * 1000) / 1000;

  const down = (mode: Mode) => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { mode, x: e.clientX, y: e.clientY, start: { ...box } };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current, el = frame.current;
    if (!d || !el) return;
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - d.x) / r.width, dy = (e.clientY - d.y) / r.height;
    const s = d.start, MIN = 0.04;
    let { x, y, w, h } = s;
    if (d.mode === 'move') {
      x = clamp(s.x + dx, 0, 1 - s.w); y = clamp(s.y + dy, 0, 1 - s.h);
    } else {
      if (d.mode.includes('w')) { x = clamp(s.x + dx, 0, s.x + s.w - MIN); w = s.x + s.w - x; }
      if (d.mode.includes('e')) { w = clamp(s.w + dx, MIN, 1 - s.x); }
      if (d.mode.includes('n')) { y = clamp(s.y + dy, 0, s.y + s.h - MIN); h = s.y + s.h - y; }
      if (d.mode.includes('s')) { h = clamp(s.h + dy, MIN, 1 - s.y); }
    }
    onChange({ x: round(x), y: round(y), w: round(w), h: round(h) });
  };
  const up = () => { drag.current = null; };

  const corner = (m: Mode, cls: string) => (
    <span onPointerDown={down(m)} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      className={`absolute h-3.5 w-3.5 rounded-sm border-2 border-purple-600 bg-white ${cls}`}
      style={{ cursor: m === 'nw' || m === 'se' ? 'nwse-resize' : 'nesw-resize', touchAction: 'none' }} aria-hidden />
  );

  return (
    <div ref={frame} className="relative w-full select-none overflow-hidden rounded border" style={{ touchAction: 'none' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Preview of the words" draggable={false} onLoad={() => setLoading(false)} onError={() => setLoading(false)} className="block w-full" />
      <div onPointerDown={down('move')} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        className="absolute cursor-move border-2 border-dashed border-purple-600 bg-purple-500/10"
        style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%`, touchAction: 'none' }}
        role="slider" aria-label="Words box: drag to move" aria-valuetext={`left ${Math.round(box.x * 100)}%, top ${Math.round(box.y * 100)}%`}>
        {corner('nw', '-left-2 -top-2')}{corner('ne', '-right-2 -top-2')}{corner('sw', '-bottom-2 -left-2')}{corner('se', '-bottom-2 -right-2')}
      </div>
      {loading && <span className="absolute right-1 top-1 rounded bg-white/90 px-1.5 py-0.5 text-[10px] text-gray-700">Redrawing…</span>}
    </div>
  );
}
