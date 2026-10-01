'use client';

/**
 * Admin → Quizzes → Result types: the 16 types, each with copy and its Pawsonalities design.
 */
import { useEffect, useState } from 'react';
import { CatalogImage } from '@/components/CloudinaryImageDisplay';
import { AdminSupabaseService } from '@/lib/admin-supabase';
import { poleLabel, type AdminResultTypeRow } from '@/lib/quiz/admin';
import type { Pole } from '@/lib/quiz/types';

const field = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200';

type Design = { id: string; description: string | null; breed: string | null };

export default function ResultTypesTab({ quizId, animal, types, onChange, onError }: {
  quizId: string;
  animal: 'dog' | 'cat';
  types: AdminResultTypeRow[];
  onChange: (next: AdminResultTypeRow[]) => void;
  onError: (msg: string | null) => void;
}) {
  const [code, setCode] = useState<string>(types[0]?.code ?? 'ESTB');
  const [designs, setDesigns] = useState<{ theme: string | null; designs: Design[] } | null>(null);
  const selected = types.find(t => t.code === code) ?? null;

  useEffect(() => {
    (async () => {
      const r = await new AdminSupabaseService().getPawsonalityDesigns(animal);
      setDesigns(r.ok ? r.data : { theme: null, designs: [] });
    })();
  }, [animal]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_460px]">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 self-start">
        {types.map(t => (
          <li key={t.code}>
            <button type="button" onClick={() => setCode(t.code)} aria-current={t.code === code ? 'true' : undefined}
              className={`w-full rounded-xl border p-3 text-left transition ${t.code === code ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
              <span className="inline-flex rounded bg-gray-900 px-1.5 py-0.5 text-xs font-bold tracking-wider text-white">{t.code}</span>
              <span className="mt-2 block text-sm font-semibold text-gray-900">{t.name}</span>
              <span className="block text-xs text-gray-600">{t.design_image_id ? 'Design linked' : 'No design yet'}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="lg:sticky lg:top-4 lg:self-start">
        {selected && (
          <TypeEditor key={selected.code} quizId={quizId} animal={animal} type={selected} designs={designs}
            onSaved={row => onChange(types.map(t => (t.code === row.code ? row : t)))} onError={onError} />
        )}
      </div>
    </div>
  );
}

function TypeEditor({ quizId, animal, type, designs, onSaved, onError }: {
  quizId: string;
  animal: 'dog' | 'cat';
  type: AdminResultTypeRow;
  designs: { theme: string | null; designs: Design[] } | null;
  onSaved: (row: AdminResultTypeRow) => void;
  onError: (msg: string | null) => void;
}) {
  const [form, setForm] = useState({
    name: type.name, tagline: type.tagline ?? '', traits: (type.traits || []).join('\n'),
    signature_move: type.signature_move ?? '', owner_reality: type.owner_reality ?? '',
    share_quote: type.share_quote ?? '', design_image_id: type.design_image_id ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const set = (k: keyof typeof form, v: string) => { setForm(f => ({ ...f, [k]: v })); setSaved(false); };
  const letters = type.code.split('').map(p => poleLabel(p as Pole, animal)).join(' · ');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const r = await new AdminSupabaseService().updateQuizResultType(quizId, type.code, {
      ...form,
      traits: form.traits.split('\n').map(s => s.trim()).filter(Boolean),
      design_image_id: form.design_image_id.trim() || null,
    });
    setSaving(false);
    if (!r.ok) { onError(r.error); return; }
    onError(null); setSaved(true); onSaved(r.data);
  }

  return (
    <form onSubmit={save} aria-label={`Edit ${type.code}`} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
      <div>
        <h3 className="font-semibold text-gray-900">{type.code}</h3>
        <p className="text-xs text-gray-600">{letters}. Copy should match all four.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="t-name" className="text-sm font-medium">Name</label>
          <input id="t-name" value={form.name} onChange={e => set('name', e.target.value)} className={field} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="t-tag" className="text-sm font-medium">Tagline</label>
          <input id="t-tag" value={form.tagline} onChange={e => set('tagline', e.target.value)} className={field} />
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="t-traits" className="text-sm font-medium">Traits <span className="font-normal text-gray-600">(one per line)</span></label>
        <textarea id="t-traits" rows={3} value={form.traits} onChange={e => set('traits', e.target.value)} className={field} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="t-sig" className="text-sm font-medium">Signature move</label>
        <input id="t-sig" value={form.signature_move} onChange={e => set('signature_move', e.target.value)} className={field} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="t-owner" className="text-sm font-medium">Owner reality</label>
        <input id="t-owner" value={form.owner_reality} onChange={e => set('owner_reality', e.target.value)} className={field} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="t-quote" className="text-sm font-medium">Share quote <span className="font-normal text-gray-600">(use [PET_NAME])</span></label>
        <input id="t-quote" value={form.share_quote} onChange={e => set('share_quote', e.target.value)} className={field} />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Pawsonalities design</legend>
        {designs === null && <p className="text-xs text-gray-600">Loading designs…</p>}
        {designs && designs.designs.length === 0 && (
          <p className="text-xs text-gray-600">
            No designs found in a Pawsonalities theme yet. Add the theme and its designs in the catalogue, then pick one here, or paste a catalogue image id below.
          </p>
        )}
        {designs && designs.designs.length > 0 && (
          <div className="grid max-h-56 grid-cols-4 gap-2 overflow-y-auto rounded-lg border border-gray-100 p-2">
            {designs.designs.map(d => (
              <button key={d.id} type="button" onClick={() => set('design_image_id', d.id)}
                aria-pressed={form.design_image_id === d.id} title={d.description ?? d.id}
                className={`overflow-hidden rounded-md border-2 ${form.design_image_id === d.id ? 'border-purple-600' : 'border-transparent'} [&>div]:h-full`}>
                <CatalogImage imageId={d.id} alt={d.description ?? 'Design'} sizes="100px" className="aspect-[2/3] h-full w-full object-cover !shadow-none !rounded-none" />
              </button>
            ))}
          </div>
        )}
        <label htmlFor="t-design" className="sr-only">Catalogue image id</label>
        <input id="t-design" value={form.design_image_id} onChange={e => set('design_image_id', e.target.value)}
          placeholder="Catalogue image id" className={`${field} font-mono text-xs`} />
      </fieldset>

      <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-3">
        {saved && <span className="text-xs text-green-700" role="status">Saved to draft</span>}
        <button type="submit" disabled={saving} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {saving ? 'Saving…' : 'Save to draft'}
        </button>
      </div>
    </form>
  );
}
