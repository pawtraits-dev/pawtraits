'use client';

/**
 * Admin → Quizzes → Result types: the 16 types, each with copy, a picture prompt (composition only;
 * the style is added separately) and its Pawsonalities designs (several allowed, e.g. one per style;
 * the first is the main design used for results and breed pictures).
 */
import { useEffect, useState } from 'react';
import { ArrowUp, Check, Copy, X } from 'lucide-react';
import { CatalogImage } from '@/components/CloudinaryImageDisplay';
import { AdminSupabaseService } from '@/lib/admin-supabase';
import { poleLabel, type AdminResultTypeRow } from '@/lib/quiz/admin';
import type { Pole } from '@/lib/quiz/types';

const field = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200';

type Design = { id: string; description: string | null; breed: string | null; style: string | null };

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
              <span className="block text-xs text-gray-600">
                {(() => { const n = t.design_image_ids?.length || (t.design_image_id ? 1 : 0); return n ? `${n} design${n === 1 ? '' : 's'}` : 'No design yet'; })()}
                {t.image_prompt ? ' · prompt' : ''}
              </span>
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
    share_quote: type.share_quote ?? '', image_prompt: type.image_prompt ?? '',
  });
  const [designIds, setDesignIds] = useState<string[]>(
    type.design_image_ids?.length ? type.design_image_ids : type.design_image_id ? [type.design_image_id] : [],
  );
  const [pasteId, setPasteId] = useState('');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const set = (k: keyof typeof form, v: string) => { setForm(f => ({ ...f, [k]: v })); setSaved(false); };
  const setIds = (next: string[]) => { setDesignIds(next); setSaved(false); };
  const toggle = (id: string) => setIds(designIds.includes(id) ? designIds.filter(x => x !== id) : [...designIds, id]);
  const makeMain = (id: string) => setIds([id, ...designIds.filter(x => x !== id)]);
  const designById = new Map((designs?.designs ?? []).map(d => [d.id, d]));
  async function copyPrompt() {
    try { await navigator.clipboard.writeText(form.image_prompt); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  }
  const letters = type.code.split('').map(p => poleLabel(p as Pole, animal)).join(' · ');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const r = await new AdminSupabaseService().updateQuizResultType(quizId, type.code, {
      ...form,
      traits: form.traits.split('\n').map(s => s.trim()).filter(Boolean),
      design_image_ids: designIds,
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

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="t-prompt" className="text-sm font-medium">Picture prompt <span className="font-normal text-gray-600">(composition only: add the style yourself)</span></label>
          {form.image_prompt && (
            <button type="button" onClick={copyPrompt} className="inline-flex items-center gap-1 text-xs font-medium text-purple-700 hover:underline">
              {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />} {copied ? 'Copied' : 'Copy'}
            </button>
          )}
        </div>
        <textarea id="t-prompt" rows={5} value={form.image_prompt} onChange={e => set('image_prompt', e.target.value)}
          placeholder={`What the ${animal} is doing and wearing, and the setting`} className={field} />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Pawsonalities designs <span className="font-normal text-gray-600">(one per style; the first is the main one)</span></legend>

        {designIds.length > 0 ? (
          <ol className="space-y-1.5">
            {designIds.map((id, i) => {
              const d = designById.get(id);
              return (
                <li key={id} className="flex items-center gap-2 rounded-lg border border-gray-200 p-1.5">
                  <span className="h-14 w-10 shrink-0 overflow-hidden rounded [&>div]:h-full">
                    <CatalogImage imageId={id} alt={d?.description ?? 'Design'} sizes="60px" className="h-full w-full object-cover !shadow-none !rounded-none" />
                  </span>
                  <span className="min-w-0 flex-1 text-xs">
                    <span className="block font-medium text-gray-900">{d?.style ?? 'Style not set'}{i === 0 && <span className="ml-1.5 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-800">Main</span>}</span>
                    <span className="block truncate text-gray-600">{d?.breed ?? ''}{d?.breed && d?.description ? ' · ' : ''}{d?.description ?? (d ? '' : id)}</span>
                  </span>
                  {i > 0 && (
                    <button type="button" onClick={() => makeMain(id)} title="Make main design" aria-label="Make main design" className="rounded p-1 text-gray-600 hover:bg-gray-100">
                      <ArrowUp className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                  <button type="button" onClick={() => toggle(id)} title="Remove" aria-label="Remove design" className="rounded p-1 text-gray-600 hover:bg-gray-100 hover:text-red-700">
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ol>
        ) : <p className="text-xs text-gray-600">No designs linked yet.</p>}

        {designs === null && <p className="text-xs text-gray-600">Loading designs…</p>}
        {designs && designs.designs.length === 0 && (
          <p className="text-xs text-gray-600">
            No designs found in a Pawsonalities theme yet. Add the theme and its designs in the catalogue, then pick them here, or paste a catalogue image id below.
          </p>
        )}
        {designs && designs.designs.length > 0 && (
          <>
            <p className="text-xs text-gray-600">Click to add or remove:</p>
            <div className="grid max-h-56 grid-cols-4 gap-2 overflow-y-auto rounded-lg border border-gray-100 p-2">
              {designs.designs.map(d => {
                const on = designIds.includes(d.id);
                return (
                  <button key={d.id} type="button" onClick={() => toggle(d.id)}
                    aria-pressed={on} title={[d.style, d.breed, d.description].filter(Boolean).join(' · ') || d.id}
                    className={`relative overflow-hidden rounded-md border-2 ${on ? 'border-purple-600' : 'border-transparent'} [&>div]:h-full`}>
                    <CatalogImage imageId={d.id} alt={d.description ?? 'Design'} sizes="100px" className="aspect-[2/3] h-full w-full object-cover !shadow-none !rounded-none" />
                    {d.style && <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1 py-0.5 text-[10px] text-white">{d.style}</span>}
                    {on && <span className="absolute right-1 top-1 rounded-full bg-purple-600 p-0.5 text-white"><Check className="h-3 w-3" aria-hidden="true" /></span>}
                  </button>
                );
              })}
            </div>
          </>
        )}
        <div className="flex gap-2">
          <label htmlFor="t-design" className="sr-only">Catalogue image id</label>
          <input id="t-design" value={pasteId} onChange={e => setPasteId(e.target.value)}
            placeholder="Or paste a catalogue image id" className={`${field} font-mono text-xs`} />
          <button type="button" disabled={!pasteId.trim() || designIds.includes(pasteId.trim())}
            onClick={() => { setIds([...designIds, pasteId.trim()]); setPasteId(''); }}
            className="shrink-0 rounded-lg border border-gray-300 px-3 text-sm font-medium disabled:opacity-40">Add</button>
        </div>
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
