'use client';

/**
 * Upload a design straight onto a quiz result type: same AI analysis and catalogue save as
 * Admin → Catalogue → Upload, but the title is the type's name and the description is written
 * about the type's personality. Saved into the Pawsonalities theme, then linked to the type.
 */
import { useEffect, useRef, useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { fileForSaving, inspectImage, shrinkImage } from '@/lib/catalog/client-image';

type Opt = { id: string; name: string };
type Pending = {
  file: File;
  preview: string;
  formatId: string;
  warning: string | null;
  status: 'analysing' | 'ready' | 'saving' | 'error';
  error: string | null;
  analysis: any | null;
  description: string;
  breedId: string;
  coatId: string | null;
  confidence: number | null;
};

const field = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200';

/** Make sure the description opens with **Title** (the AI is asked to, this guarantees it) */
function withTitle(description: string, title: string): string {
  const body = description.trim().replace(/^\*\*[^*\n]+\*\*\s*\n?/, '').trim();
  return `**${title}**\n${body}`;
}

export default function TypeDesignUpload({ animal, type, themeId, onSaved }: {
  animal: 'dog' | 'cat';
  type: { code: string; name: string; tagline: string | null; traits: string[]; signature_move: string | null; owner_reality: string | null };
  themeId: string | null;
  onSaved: (design: { id: string; description: string; breed: string | null; style: string | null }) => void;
}) {
  const [styles, setStyles] = useState<Opt[]>([]);
  const [formats, setFormats] = useState<{ id: string; name: string; aspect_ratio: string }[]>([]);
  const [breeds, setBreeds] = useState<(Opt & { animal_type: string })[]>([]);
  const [styleId, setStyleId] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all(['/api/styles', '/api/formats', '/api/breeds'].map(u => fetch(u).then(r => r.json())))
      .then(([s, f, b]) => {
        setStyles(s.filter((x: any) => x.is_active));
        setFormats(f.filter((x: any) => x.is_active));
        setBreeds(b.filter((x: any) => x.is_active && (x.animal_type ?? animal) === animal).sort((a: any, z: any) => a.name.localeCompare(z.name)));
      })
      .catch(() => setError('Could not load styles, formats and breeds'));
  }, [animal]);

  const brief = [
    `Result "${type.name}" (${type.code}) in the Pawsonality personality quiz for ${animal}s.`,
    type.tagline && `Tagline: ${type.tagline}.`,
    type.traits?.length ? `Traits: ${type.traits.join('; ')}.` : null,
    type.signature_move && `Signature move: ${type.signature_move}.`,
    type.owner_reality && `Owner reality: ${type.owner_reality}`,
  ].filter(Boolean).join(' ');

  async function pick(file: File) {
    setError(null);
    if (!/image\/(jpeg|png|webp)/.test(file.type)) { setError('Use a JPG, PNG or WebP image'); return; }
    let info;
    try { info = await inspectImage(file, formats); } catch (e: any) { setError(e.message); return; }
    const p: Pending = { file, preview: info.preview, formatId: info.formatId, warning: info.warning, status: 'analysing', error: null, analysis: null, description: '', breedId: '', coatId: null, confidence: null };
    setPending(p);
    try {
      const small = await shrinkImage(file, 1600, 3 * 1024 * 1024);
      const fd = new FormData();
      fd.append('image', small);
      if (themeId) fd.append('themeId', themeId);
      if (styleId) fd.append('styleId', styleId);
      fd.append('brief', brief);
      fd.append('title', type.name);
      const res = await fetch('/api/admin/analyze-composition', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Analysis failed (${res.status})`);
      const s = data.subjects?.[0];
      setPending(cur => cur && cur.file === file ? {
        ...cur, status: 'ready', analysis: data,
        description: withTitle(data.marketingDescription || '', type.name),
        breedId: s?.breedId || s?.suggestedBreed?.id || '',
        coatId: s?.coatId || s?.suggestedCoat?.id || null,
        confidence: s?.suggestedBreed?.confidence ?? null,
      } : cur);
    } catch (e: any) {
      setPending(cur => cur && cur.file === file ? { ...cur, status: 'error', error: e.message } : cur);
    }
  }

  async function save() {
    if (!pending?.analysis) return;
    if (!pending.formatId) { setError('Choose a format'); return; }
    if (!pending.breedId) { setError('Choose a breed'); return; }
    setError(null);
    setPending({ ...pending, status: 'saving' });
    try {
      const a = pending.analysis;
      // The chosen breed goes on the main subject; a changed breed drops the AI's coat guess
      const subjects = (a.subjects?.length ? a.subjects : [{ subjectOrder: 1, isPrimary: true, position: 'center', poseDescription: '' }])
        .map((s: any, i: number) => i === 0 ? { ...s, breedId: pending.breedId, coatId: s.breedId === pending.breedId || s.suggestedBreed?.id === pending.breedId ? pending.coatId : null } : s);
      const fd = new FormData();
      fd.append('image', await fileForSaving(pending.file));
      fd.append('filename', pending.file.name);
      fd.append('marketingDescription', withTitle(pending.description, type.name));
      fd.append('compositionAnalysis', a.compositionAnalysis || '');
      fd.append('isMultiSubject', String(subjects.length > 1));
      fd.append('subjects', JSON.stringify(subjects));
      if (themeId) fd.append('themeId', themeId);
      if (styleId) fd.append('styleId', styleId);
      fd.append('formatId', pending.formatId);
      fd.append('tags', JSON.stringify(Array.from(new Set(['pawsonality', type.name.replace(/^The\s+/i, '').toLowerCase(), ...(a.tags || [])])).slice(0, 10)));
      fd.append('isFeatured', 'false');
      fd.append('isPublic', String(isPublic));
      fd.append('variationPromptTemplate', a.variationPromptTemplate || '');
      fd.append('compositionMetadata', JSON.stringify(a.compositionMetadata ?? null));
      const res = await fetch('/api/admin/catalog/save', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || `Save failed (${res.status})`);
      onSaved({
        id: data.imageId,
        description: withTitle(pending.description, type.name),
        breed: breeds.find(b => b.id === pending.breedId)?.name ?? null,
        style: styles.find(s => s.id === styleId)?.name ?? null,
      });
      URL.revokeObjectURL(pending.preview);
      setPending(null);
    } catch (e: any) {
      setPending(cur => cur ? { ...cur, status: 'ready' } : cur);
      setError(e.message);
    }
  }

  const busy = pending?.status === 'analysing' || pending?.status === 'saving';

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-purple-300 bg-purple-50/40 p-3">
      <p className="text-sm font-medium text-gray-900">Upload a design for {type.name}</p>
      {!themeId && <p className="text-xs text-amber-700">No Pawsonalities theme found. Create one in Themes first, so uploaded designs are filed under it.</p>}
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-gray-600">Style
          <select value={styleId} onChange={e => setStyleId(e.target.value)} disabled={busy} className={`${field} mt-0.5 py-1.5`}>
            <option value="">Choose…</option>
            {styles.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm text-gray-700">
          <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="h-4 w-4 accent-purple-600" /> Public in the catalogue
        </label>
      </div>

      {!pending && (
        <>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) pick(f); }} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={!styleId || !formats.length}
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40">
            <Upload className="h-4 w-4" aria-hidden="true" /> Choose image
          </button>
          {!styleId && <p className="text-xs text-gray-600">Pick the style first, so each style&apos;s design is labelled.</p>}
        </>
      )}

      {pending && (
        <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-2">
          <div className="flex gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pending.preview} alt="" className="h-28 w-20 shrink-0 rounded object-contain bg-gray-50" />
            <div className="min-w-0 flex-1 space-y-1.5">
              {pending.status === 'analysing' && <p className="flex items-center gap-1.5 text-sm text-gray-600"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Analysing and writing the description…</p>}
              {pending.status === 'error' && <p className="text-sm text-red-700">{pending.error}</p>}
              {pending.warning && <p className="text-xs text-amber-700">{pending.warning}</p>}
              {(pending.status === 'ready' || pending.status === 'saving') && (
                <>
                  <label className="block text-xs text-gray-600">Breed{pending.confidence !== null && ` (AI ${Math.round(pending.confidence * 100)}% sure)`}
                    <select value={pending.breedId} onChange={e => setPending({ ...pending, breedId: e.target.value })} disabled={busy}
                      className={`${field} mt-0.5 py-1.5 ${!pending.breedId ? 'border-amber-400' : ''}`}>
                      <option value="">Choose breed…</option>
                      {breeds.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </label>
                  <label className="block text-xs text-gray-600">Format
                    <select value={pending.formatId} onChange={e => setPending({ ...pending, formatId: e.target.value })} disabled={busy}
                      className={`${field} mt-0.5 py-1.5 ${!pending.formatId ? 'border-amber-400' : ''}`}>
                      <option value="">Choose…</option>
                      {formats.map(f => <option key={f.id} value={f.id}>{f.name} ({f.aspect_ratio})</option>)}
                    </select>
                  </label>
                </>
              )}
            </div>
            <button type="button" onClick={() => { URL.revokeObjectURL(pending.preview); setPending(null); }} disabled={pending.status === 'saving'}
              aria-label="Cancel upload" className="self-start rounded p-1 text-gray-500 hover:bg-gray-100"><X className="h-4 w-4" aria-hidden="true" /></button>
          </div>
          {(pending.status === 'ready' || pending.status === 'saving') && (
            <>
              <label className="block text-xs text-gray-600">Description <span className="text-gray-500">(the title is always “{type.name}”)</span>
                <textarea rows={6} value={pending.description} onChange={e => setPending({ ...pending, description: e.target.value })} disabled={busy}
                  className={`${field} mt-0.5`} />
              </label>
              <div className="flex justify-end">
                <button type="button" onClick={save} disabled={busy || !pending.breedId || !pending.formatId}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40">
                  {pending.status === 'saving' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Save to catalogue and link
                </button>
              </div>
            </>
          )}
          {pending.status === 'error' && (
            <div className="flex justify-end">
              <button type="button" onClick={() => pick(pending.file)} className="rounded-lg border px-3 py-1.5 text-sm">Try again</button>
            </div>
          )}
        </div>
      )}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
