'use client';

/**
 * Admin → Catalogue → a design → Words on the picture. Upload a text-free copy, write the words
 * with {pet} where the name or breed goes, choose the font, colour and box (live preview), then
 * draw them on the design and its breed versions. Data: /api/admin/catalog/[id]/words.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  const preview = useMemo(() => {
    if (!clean || !info) return null;
    const w: PictureWords = { ...form, aspect: info.words?.aspect ?? null, clean_public_id: clean, original_public_id: null, applied: null };
    return `https://res.cloudinary.com/${info.cloudName}/image/upload/c_limit,w_700/${wordsLayer(w, fillWords(form.template, phrase))}/f_auto,q_auto/${clean}`;
  }, [clean, info, form, phrase]);

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

  const apply = async (versions: boolean) => {
    if (!(await save())) return;
    setBusy(versions ? 'Drawing the words on the design and its versions…' : 'Drawing the words on the design…');
    const r = await svc().pictureWordsAction(imageId, { action: 'apply', versions });
    setBusy(null);
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
    const v = r.data.versions;
    setMsg({ ok: true, text: `Done: “${r.data.text}”.${v ? ` Versions: ${v.updated} updated${v.failed ? `, ${v.failed} failed` : ''}${v.needsRemake ? `, ${v.needsRemake} made before the text-free copy (they still have the old words: make them again)` : ''}.` : ''}` });
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Preview of the words" className="w-full rounded border" />
              <p className="mt-1 text-[11px] text-gray-500">The box is invisible; words wrap inside it and get smaller if they don&apos;t fit.</p>
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
