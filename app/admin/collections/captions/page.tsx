'use client';

/**
 * Admin → Collections → Captions: the wording on the translucent gold name plate for each
 * Pawsonality type and Zodiac sign, dog and cat versions (defaults: the quiz's names and taglines;
 * zodiac taglines from lib/captions/caption.ts). Live preview on a picture from that type/sign.
 * "Put on all" draws the plate on every design in it (redrawing ones with older wording); designs
 * can also be done one at a time in Admin → Catalogue. Data: /api/admin/captions.
 */
import { useEffect, useMemo, useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { AdminSupabaseService } from '@/lib/admin-supabase';
import { CAPTION_MAX, captionLayer, type Caption, type CaptionWording } from '@/lib/captions/caption';
import { frameCrop, frameLayers, frameTitle, type FrameCard } from '@/lib/frames/frame';

type Key = keyof CaptionWording;
interface Row {
  id: string; path: string; kind: 'pawsonality' | 'zodiac' | 'tarot'; slug: string; name: string; code: string | null;
  defaults: Required<CaptionWording>; wording: CaptionWording; designs: number; captioned: number; framed: number;
  dog: Caption | null; cat: Caption | null; hasFrame: boolean; dogCard: FrameCard | null; catCard: FrameCard | null;
  sample: { id: string; publicId: string; animal: 'dog' | 'cat'; aspect: number } | null;
}

function RowEditor({ row, cloudName, onSaved }: { row: Row; cloudName: string; onSaved: () => void }) {
  const svc = () => new AdminSupabaseService();
  const value = (k: Key) => (typeof row.wording[k] === 'string' ? row.wording[k]! : row.defaults[k]);
  const [form, setForm] = useState<Required<CaptionWording>>({ title_dog: value('title_dog'), title_cat: value('title_cat'), tagline_dog: value('tagline_dog'), tagline_cat: value('tagline_cat') });
  const [animal, setAnimal] = useState<'dog' | 'cat'>(row.sample?.animal ?? 'dog');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = (Object.keys(form) as Key[]).some(k => form[k] !== value(k));

  // Preview redrawn by Cloudinary a moment after typing stops
  const [shown, setShown] = useState(form);
  useEffect(() => { const t = setTimeout(() => setShown(form), 500); return () => clearTimeout(t); }, [form]);
  // Tarot cards have the frame only; zodiac signs can show either
  const [look, setLook] = useState<'plate' | 'frame'>(row.kind === 'tarot' ? 'frame' : 'plate');
  const preview = useMemo(() => {
    if (!row.sample || !cloudName) return null;
    const title = shown[`title_${animal}`].trim();
    if (!title) return null;
    if (look === 'frame' || row.kind === 'tarot') {
      const base = animal === 'cat' ? row.catCard : row.dogCard;
      if (!base?.medallion) return null;
      const card: FrameCard = { title: frameTitle(title), tagline: shown[`tagline_${animal}`].trim() || null, medallion: base.medallion };
      return `https://res.cloudinary.com/${cloudName}/image/upload/${frameCrop('2:3')}/c_limit,w_360/${frameLayers(card, '2:3')}/f_jpg,q_80/${row.sample.publicId}`;
    }
    const c: Caption = { title, tagline: shown[`tagline_${animal}`].trim() || null, symbol: row.kind === 'zodiac' ? row.slug : null };
    return `https://res.cloudinary.com/${cloudName}/image/upload/c_limit,w_360/${captionLayer(c, row.sample.aspect)}/f_jpg,q_80/${row.sample.publicId}`;
  }, [shown, animal, look, row, cloudName]);

  const save = async () => {
    setBusy('Saving…'); setMsg(null);
    // Same as the default → stored as "use the default" so quiz renames flow through
    const wording: Record<string, string | null> = {};
    for (const k of Object.keys(form) as Key[]) wording[k] = form[k].trim() === row.defaults[k] ? null : form[k].trim();
    const r = await svc().saveCaptionWording(row.id, wording);
    setBusy(null);
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
    const shownOn = row.captioned + row.framed;
    setMsg({ ok: true, text: shownOn ? `Saved. ${shownOn} picture${shownOn === 1 ? ' shows' : 's show'} the older wording: press "Put on all" to redraw.` : 'Saved.' });
    onSaved();
  };
  const all = async (on: boolean, what: 'plate' | 'frame' = 'plate') => {
    if (!on && !confirm(`Take the ${what} off all ${row.designs} ${row.name} designs?`)) return;
    setBusy(on ? `Drawing the ${what} on ${row.designs} designs… (a few seconds each)` : `Taking the ${what}s off…`); setMsg(null);
    const r = await svc().captionCollection(row.id, on, what);
    setBusy(null);
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
    const d = r.data;
    setMsg({ ok: !d.failed, text: `${on ? `${what === 'frame' ? 'Frame' : 'Plate'} on` : `${what === 'frame' ? 'Frame' : 'Plate'} off`}: ${d.done} changed${d.failed ? `, ${d.failed} failed (${d.errors.join('; ')})` : ''}${d.skipped ? `, ${d.skipped} still to do: press again to carry on` : ''}.` });
    onSaved();
  };

  const field = (k: Key, label: string) => (
    <label className="block text-xs text-gray-600">{label}
      <div className="mt-0.5 flex gap-1">
        <input value={form[k]} maxLength={k.startsWith('title') ? CAPTION_MAX.title : CAPTION_MAX.tagline}
          onChange={e => { setForm(f => ({ ...f, [k]: e.target.value })); if (k.endsWith('_cat')) setAnimal('cat'); else setAnimal('dog'); }}
          placeholder={k.startsWith('tagline') ? 'No tagline' : ''}
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900" />
        {form[k] !== row.defaults[k] && (
          <button type="button" title={`Back to the default: ${row.defaults[k] || '(none)'}`} onClick={() => setForm(f => ({ ...f, [k]: row.defaults[k] }))} className="rounded border border-gray-200 px-1.5 text-gray-500 hover:text-purple-700"><RotateCcw className="h-3 w-3" /></button>
        )}
      </div>
    </label>
  );

  return (
    <li className="grid gap-3 rounded-xl border border-gray-200 bg-white p-3 sm:grid-cols-[120px_1fr]">
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview ? <img src={preview} alt={`${row.name} with the plate`} className="w-full rounded border border-gray-200" /> : <div className="flex aspect-[2/3] items-center justify-center rounded bg-gray-100 text-center text-xs text-gray-500">No designs yet</div>}
        {row.kind === 'zodiac' && (
          <div className="mt-1 flex justify-center gap-1 text-[11px]" role="radiogroup" aria-label="Preview style">
            {(['plate', 'frame'] as const).map(l => <button key={l} role="radio" aria-checked={look === l} onClick={() => setLook(l)} className={`rounded px-2 py-0.5 ${look === l ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{l}</button>)}
          </div>
        )}
        <div className="mt-1 flex justify-center gap-1 text-[11px]" role="radiogroup" aria-label="Preview wording">
          {(['dog', 'cat'] as const).map(a => <button key={a} role="radio" aria-checked={animal === a} onClick={() => setAnimal(a)} className={`rounded px-2 py-0.5 ${animal === a ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{a}</button>)}
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold text-gray-900">{row.code ? `${row.code} · ` : ''}{row.name}</h3>
          <span className="text-xs text-gray-500">{row.designs} design{row.designs === 1 ? '' : 's'}{row.kind !== 'tarot' && ` · plate on ${row.captioned}`}{row.hasFrame && ` · frame on ${row.framed}`}</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {field('title_dog', 'Title (dogs)')}{field('tagline_dog', 'Tagline (dogs)')}
          {field('title_cat', 'Title (cats)')}{field('tagline_cat', 'Tagline (cats)')}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button disabled={!!busy || !dirty} onClick={save} className="rounded bg-purple-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40">Save wording</button>
          {row.kind !== 'tarot' && <button disabled={!!busy || dirty || !row.designs} onClick={() => all(true)} title={dirty ? 'Save the wording first' : undefined} className="rounded bg-amber-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40">Put on all {row.designs}</button>}
          {row.kind !== 'tarot' && row.captioned > 0 && <button disabled={!!busy} onClick={() => all(false)} className="rounded border border-gray-300 px-3 py-1 text-xs disabled:opacity-40">Take off all</button>}
          {row.hasFrame && <button disabled={!!busy || dirty || !row.designs} onClick={() => all(true, 'frame')} title={dirty ? 'Save the wording first' : undefined} className="rounded bg-indigo-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40">Put the frame on all</button>}
          {row.hasFrame && row.framed > 0 && <button disabled={!!busy} onClick={() => all(false, 'frame')} className="rounded border border-gray-300 px-3 py-1 text-xs disabled:opacity-40">Take the frame off all</button>}
          {busy && <span role="status" className="flex items-center gap-1 text-xs text-gray-700"><Loader2 className="h-3 w-3 animate-spin" /> {busy}</span>}
          {msg && <span role={msg.ok ? 'status' : 'alert'} className={`text-xs ${msg.ok ? 'text-green-700' : 'text-red-700'}`}>{msg.text}</span>}
        </div>
      </div>
    </li>
  );
}

export default function CaptionsPage() {
  const [data, setData] = useState<{ rows: Row[]; cloudName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<'pawsonality' | 'zodiac' | 'tarot'>('pawsonality');
  const load = async () => {
    const r = await new AdminSupabaseService().getCaptions();
    if (!r.ok) setError(r.error); else { setData(r.data); setError(null); }
  };
  useEffect(() => { load(); }, []);
  const rows = (data?.rows ?? []).filter(r => r.kind === kind);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Captions</h1>
        <p className="text-sm text-gray-600">The translucent gold name plate on Pawsonality and Zodiac pictures (and the title and tagline of framed cards): the type, sign or card and a tagline, worded separately for dogs and cats. Customers can switch it on or off when they make their picture, and you choose it for variations. Empty tagline = title only. Zodiac taglines are shared by the plate and the frame; tarot cards (22, in order) have the frame only.</p>
      </div>
      <div className="flex gap-2" role="tablist">
        {(['pawsonality', 'zodiac', 'tarot'] as const).map(k => (
          <button key={k} role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${kind === k ? 'bg-purple-600 text-white' : 'bg-white text-gray-700 border border-gray-200'}`}>
            {k === 'pawsonality' ? '16 Pawsonalities' : k === 'zodiac' ? 'Zodiac signs' : 'Tarot cards'}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!data && !error && <p className="text-sm text-gray-500">Loading…</p>}
      <ul className="space-y-3">
        {rows.map(r => <RowEditor key={`${r.id}:${JSON.stringify(r.wording)}:${r.captioned}:${r.framed}`} row={r} cloudName={data!.cloudName} onSaved={load} />)}
      </ul>
    </div>
  );
}
