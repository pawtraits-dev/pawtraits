'use client';

/**
 * Admin → Quizzes → Result types: the 16 types, each with copy, a picture prompt (composition only;
 * the style is added separately) and its Pawsonalities designs (any number; the first is the main
 * design used for results and breed pictures).
 */
import { useEffect, useState } from 'react';
import { ArrowUp, Check, Copy, X } from 'lucide-react';
import { designTitle } from '@/lib/text/plain';
import { AdminSupabaseService } from '@/lib/admin-supabase';
import { poleLabel, type AdminResultTypeRow } from '@/lib/quiz/admin';
import TypeDesignUpload from './TypeDesignUpload';
import type { Pole } from '@/lib/quiz/types';

const field = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200';

type Design = { id: string; description: string | null; breed: string | null; style: string | null };
/** Small fixed-size thumbnail (a 200px-wide copy, never the full image) */
function Thumb({ id, alt, className }: { id: string; alt: string; className: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/api/secure-images/${id}?variant=mid_size&w=200`} alt={alt} loading="lazy" decoding="async"
    className={`${className} bg-gray-100 object-cover`} />;
}
type DesignList = { theme: string | null; themeId?: string | null; designs: Design[] };

export default function ResultTypesTab({ quizId, animal, types, onChange, onError }: {
  quizId: string;
  animal: 'dog' | 'cat';
  types: AdminResultTypeRow[];
  onChange: (next: AdminResultTypeRow[]) => void;
  onError: (msg: string | null) => void;
}) {
  const [code, setCode] = useState<string>(types[0]?.code ?? 'ESTB');
  const [designs, setDesigns] = useState<DesignList | null>(null);
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
              className={`flex w-full gap-3 rounded-xl border p-3 text-left transition ${t.code === code ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
              {(() => {
                const main = t.design_image_ids?.[0] ?? t.design_image_id;
                return main
                  ? <Thumb id={main} alt={t.name} className="h-16 w-11 shrink-0 rounded-md" />
                  : <span className="flex h-16 w-11 shrink-0 items-center justify-center rounded-md border border-dashed border-gray-300 text-[10px] text-gray-400">None</span>;
              })()}
              <span className="min-w-0">
                <span className="inline-flex rounded bg-gray-900 px-1.5 py-0.5 text-xs font-bold tracking-wider text-white">{t.code}</span>
                <span className="mt-1.5 block text-sm font-semibold leading-tight text-gray-900">{t.name}</span>
                <span className="block text-xs text-gray-600">
                  {(() => { const n = t.design_image_ids?.length || (t.design_image_id ? 1 : 0); return n ? `${n} design${n === 1 ? '' : 's'}` : 'No design yet'; })()}
                  {t.image_prompt ? ' · prompt' : ''}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="lg:sticky lg:top-4 lg:self-start">
        {selected && (
          <TypeEditor key={selected.code} quizId={quizId} animal={animal} type={selected} designs={designs}
            takenBy={takenBy(types, selected.code)}
            onDesignAdded={d => setDesigns(cur => ({ theme: cur?.theme ?? null, themeId: cur?.themeId ?? null, designs: [d, ...(cur?.designs ?? [])] }))}
            onSaved={row => onChange(types.map(t => (t.code === row.code ? row : t)))} onError={onError} />
        )}
      </div>
    </div>
  );
}

/** Designs already linked to another type (a design belongs to one type only): id → that type's code */
function takenBy(types: AdminResultTypeRow[], except: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const t of types) {
    if (t.code === except) continue;
    for (const id of t.design_image_ids?.length ? t.design_image_ids : t.design_image_id ? [t.design_image_id] : []) m.set(id, t.code);
  }
  return m;
}

function TypeEditor({ quizId, animal, type, designs, takenBy, onDesignAdded, onSaved, onError }: {
  quizId: string;
  animal: 'dog' | 'cat';
  type: AdminResultTypeRow;
  designs: DesignList | null;
  takenBy: Map<string, string>;
  onDesignAdded: (d: Design) => void;
  onSaved: (row: AdminResultTypeRow) => void;
  onError: (msg: string | null) => void;
}) {
  const [form, setForm] = useState({
    name: type.name, tagline: type.tagline ?? '', traits: (type.traits || []).join('\n'),
    signature_move: type.signature_move ?? '', owner_reality: type.owner_reality ?? '',
    share_quote: type.share_quote ?? '', image_prompt: type.image_prompt ?? '',
    about: type.about ?? '', famous_examples: (type.famous_examples || []).join('\n'), best_buddies: (type.best_buddies || []).join(', '),
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
  /** A design uploaded here: add it to the list and link it to the type straight away */
  async function linkUploaded(d: Design) {
    onDesignAdded(d);
    const next = [...designIds.filter(x => x !== d.id), d.id];
    setDesignIds(next);
    const r = await new AdminSupabaseService().updateQuizResultType(quizId, type.code, { design_image_ids: next });
    if (!r.ok) { onError(`Saved to the catalogue, but linking failed: ${r.error}. Press Save to draft to link it.`); return; }
    onError(null); onSaved(r.data);
  }
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
      famous_examples: form.famous_examples.split('\n').map(s => s.trim()).filter(Boolean),
      best_buddies: form.best_buddies.split(/[\s,]+/).map(s => s.trim().toUpperCase()).filter(Boolean),
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

      <fieldset className="space-y-3 rounded-lg border border-gray-100 p-3">
        <legend className="px-1 text-sm font-medium">Pawsonalities page</legend>
        <div className="space-y-1.5">
          <label htmlFor="t-about" className="text-sm font-medium">About <span className="font-normal text-gray-600">(the longer description on the type&apos;s page)</span></label>
          <textarea id="t-about" rows={5} value={form.about} onChange={e => set('about', e.target.value)} className={field} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="t-famous" className="text-sm font-medium">Famous examples <span className="font-normal text-gray-600">(one per line)</span></label>
            <textarea id="t-famous" rows={3} value={form.famous_examples} onChange={e => set('famous_examples', e.target.value)} className={field} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="t-buddies" className="text-sm font-medium">Best buddies <span className="font-normal text-gray-600">(type codes)</span></label>
            <input id="t-buddies" value={form.best_buddies} onChange={e => set('best_buddies', e.target.value)} placeholder="ESFB, ENTB" className={`${field} font-mono`} />
          </div>
        </div>
      </fieldset>

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
        <legend className="text-sm font-medium">Pawsonalities designs <span className="font-normal text-gray-600">(as many as you like; the first is the main one)</span></legend>

        {designIds.length > 0 ? (
          <ol className="space-y-1.5">
            {designIds.map((id, i) => {
              const d = designById.get(id);
              return (
                <li key={id} className="flex items-center gap-2 rounded-lg border border-gray-200 p-1.5">
                  <Thumb id={id} alt={d?.description ? designTitle(d.description) : 'Design'} className="h-14 w-10 shrink-0 rounded" />
                  <span className="min-w-0 flex-1 text-xs">
                    <span className="block truncate font-medium text-gray-900">
                      {i === 0 && <span className="mr-1.5 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-800">Main</span>}
                      {d?.description ? designTitle(d.description) : 'Design'}
                    </span>
                    <span className="block truncate text-gray-600">{[d?.breed, d?.style].filter(Boolean).join(' · ') || (d ? '' : id)}</span>
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
        {designs && designs.designs.filter(d => !takenBy.has(d.id)).length === 0 && (
          <p className="text-xs text-gray-600">
            {designs.designs.length === 0
              ? 'No designs found in a Pawsonalities theme yet. Upload one below, or add designs in the catalogue and pick them here.'
              : 'Every design in the Pawsonalities theme already belongs to a type. Upload a new one below.'}
          </p>
        )}
        {designs && designs.designs.some(d => !takenBy.has(d.id)) && (
          <>
            <p className="text-xs text-gray-600">Unused designs: click to add or remove{takenBy.size ? ` (designs linked to other types are hidden)` : ''}:</p>
            <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto rounded-lg border border-gray-100 p-2">
              {designs.designs.filter(d => !takenBy.has(d.id)).map(d => {
                const on = designIds.includes(d.id);
                return (
                  <button key={d.id} type="button" onClick={() => toggle(d.id)}
                    aria-pressed={on} title={[d.description ? designTitle(d.description) : null, d.breed, d.style].filter(Boolean).join(' · ') || d.id}
                    className={`relative shrink-0 overflow-hidden rounded-md border-2 ${on ? 'border-purple-600' : 'border-transparent'}`}>
                    <Thumb id={d.id} alt={d.description ? designTitle(d.description) : 'Design'} className="block h-20 w-14" />
                    {on && <span className="absolute right-1 top-1 rounded-full bg-purple-600 p-0.5 text-white"><Check className="h-3 w-3" aria-hidden="true" /></span>}
                  </button>
                );
              })}
            </div>
          </>
        )}
        <TypeDesignUpload animal={animal} themeId={designs?.themeId ?? null} onSaved={linkUploaded}
          type={{ code: type.code, name: form.name || type.name, tagline: form.tagline || null, traits: form.traits.split('\n').map(t => t.trim()).filter(Boolean), signature_move: form.signature_move || null, owner_reality: form.owner_reality || null }} />
        <div className="flex gap-2">
          <label htmlFor="t-design" className="sr-only">Catalogue image id</label>
          <input id="t-design" value={pasteId} onChange={e => setPasteId(e.target.value)}
            placeholder="Or paste a catalogue image id" className={`${field} font-mono text-xs`} />
          <button type="button" disabled={!pasteId.trim() || designIds.includes(pasteId.trim())}
            onClick={() => {
              const id = pasteId.trim();
              if (takenBy.has(id)) { onError(`That design already belongs to ${takenBy.get(id)}. Remove it there first.`); return; }
              setIds([...designIds, id]); setPasteId('');
            }}
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
