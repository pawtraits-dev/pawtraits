'use client';

/**
 * Admin → Quizzes → Questions: grouped by dimension, with a side editor.
 * All saves go through AdminSupabaseService → /api/admin/quizzes/... (draft only until publish).
 */
import { useEffect, useRef, useState } from 'react';
import { ImageIcon, Plus, Trash2, Upload, X } from 'lucide-react';
import { AdminSupabaseService } from '@/lib/admin-supabase';
import { DIMENSION_LABELS, poleLabel, type AdminQuestionRow } from '@/lib/quiz/admin';
import { DIMENSIONS, DIMENSION_ORDER, type Dimension, type Pole } from '@/lib/quiz/types';
import { withPetName } from '@/lib/quiz/scoring';

export type QuestionRow = AdminQuestionRow & { image_url?: string | null };

const field = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200';

export default function QuestionsTab({ quizId, animal, questions, onChange, onError }: {
  quizId: string;
  animal: 'dog' | 'cat';
  questions: QuestionRow[];
  onChange: (next: QuestionRow[]) => void;
  onError: (msg: string | null) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(questions[0]?.id ?? null);
  const [creating, setCreating] = useState<Dimension | null>(null);
  const selected = questions.find(q => q.id === selectedId) ?? null;

  function replace(row: QuestionRow) {
    onChange(questions.map(q => (q.id === row.id ? { ...q, ...row } : q)));
  }

  async function toggleActive(q: QuestionRow) {
    const r = await new AdminSupabaseService().updateQuizQuestion(quizId, q.id, { is_active: !q.is_active });
    if (r.ok) { replace(r.data); onError(null); } else onError(r.error);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-6">
        {DIMENSION_ORDER.map(dim => {
          const qs = questions.filter(q => q.dimension === dim);
          const active = qs.filter(q => q.is_active);
          const [a, b] = DIMENSIONS[dim];
          const ra = active.filter(q => q.right_pole === a).length;
          const rb = active.length - ra;
          return (
            <section key={dim} aria-labelledby={`dim-${dim}`} className="rounded-xl border border-gray-200 bg-white">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
                <div>
                  <h3 id={`dim-${dim}`} className="font-semibold text-gray-900">
                    {DIMENSION_LABELS[dim]} <span className="font-normal text-gray-600">· {poleLabel(a, animal)} or {poleLabel(b, animal)}</span>
                  </h3>
                  <p className={`text-xs ${active.length % 2 === 0 ? 'text-amber-700' : 'text-gray-600'}`}>
                    {active.length} active · right swipe scores {poleLabel(a, animal)} {ra}, {poleLabel(b, animal)} {rb}
                  </p>
                </div>
                <button type="button" onClick={() => { setCreating(dim); setSelectedId(null); }}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50">
                  <Plus className="h-4 w-4" aria-hidden="true" /> Add question
                </button>
              </header>
              <ul>
                {qs.map(q => (
                  <li key={q.id} className={`flex items-center gap-3 border-t border-gray-50 px-4 py-2 first:border-t-0 ${selectedId === q.id ? 'bg-purple-50' : ''}`}>
                    <button type="button" onClick={() => { setSelectedId(q.id); setCreating(null); }}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-current={selectedId === q.id ? 'true' : undefined}>
                      {q.image_url
                        ? <img src={q.image_url} alt="" className="h-11 w-11 shrink-0 rounded-md object-cover" />
                        : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-400"><ImageIcon className="h-5 w-5" aria-hidden="true" /></span>}
                      <span className="min-w-0">
                        <span className={`block text-sm ${q.is_active ? 'text-gray-900' : 'text-gray-500 line-through'}`}>{q.statement}</span>
                        <span className="block text-xs text-gray-600">Right swipe: {poleLabel(q.right_pole, animal)}</span>
                      </span>
                    </button>
                    <label className="flex shrink-0 items-center gap-1.5 text-xs text-gray-700">
                      <input type="checkbox" checked={q.is_active} onChange={() => toggleActive(q)} className="h-4 w-4 accent-purple-600" />
                      Active
                    </label>
                  </li>
                ))}
                {qs.length === 0 && <li className="px-4 py-3 text-sm text-gray-600">No questions yet.</li>}
              </ul>
            </section>
          );
        })}
      </div>

      <div className="lg:sticky lg:top-4 lg:self-start">
        {creating ? (
          <QuestionEditor
            key={`new-${creating}`}
            quizId={quizId} animal={animal}
            initial={{ dimension: creating, right_pole: DIMENSIONS[creating][0] as Pole, statement: '[PET_NAME] ALWAYS… ', share_quote: '', visual_brief: '', is_active: true }}
            onSaved={row => { onChange([...questions, row]); setCreating(null); setSelectedId(row.id); }}
            onCancel={() => setCreating(null)}
            onError={onError}
          />
        ) : selected ? (
          <QuestionEditor
            key={selected.id}
            quizId={quizId} animal={animal} initial={selected}
            onSaved={replace}
            onDeleted={() => { onChange(questions.filter(q => q.id !== selected.id)); setSelectedId(null); }}
            onError={onError}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-600">Choose a question to edit, or add one.</div>
        )}
      </div>
    </div>
  );
}

function QuestionEditor({ quizId, animal, initial, onSaved, onDeleted, onCancel, onError }: {
  quizId: string;
  animal: 'dog' | 'cat';
  initial: Partial<QuestionRow>;
  onSaved: (row: QuestionRow) => void;
  onDeleted?: () => void;
  onCancel?: () => void;
  onError: (msg: string | null) => void;
}) {
  const isNew = !initial.id;
  const [form, setForm] = useState({
    dimension: initial.dimension as Dimension,
    right_pole: initial.right_pole as Pole,
    statement: initial.statement ?? '',
    share_quote: initial.share_quote ?? '',
    visual_brief: initial.visual_brief ?? '',
    is_active: initial.is_active ?? true,
  });
  const [imageUrl, setImageUrl] = useState<string | null>(initial.image_url ?? null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const service = new AdminSupabaseService();

  useEffect(() => { setConfirmDelete(false); }, [initial.id]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(f => ({ ...f, [k]: v }));
  const missingToken = !form.statement.includes('[PET_NAME]');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const r = isNew ? await service.createQuizQuestion(quizId, form) : await service.updateQuizQuestion(quizId, initial.id!, form);
    setSaving(false);
    if (!r.ok) { onError(r.error); return; }
    onError(null);
    setSavedAt(Date.now());
    onSaved({ ...r.data, image_url: imageUrl });
  }

  async function upload(file: File) {
    if (!initial.id) return;
    setUploading(true);
    const r = await service.uploadQuizQuestionImage(quizId, initial.id, file);
    setUploading(false);
    if (!r.ok) { onError(r.error); return; }
    onError(null);
    setImageUrl(r.data.image_url);
    onSaved(r.data);
  }

  async function removeImage() {
    if (!initial.id) return;
    const r = await service.removeQuizQuestionImage(quizId, initial.id);
    if (!r.ok) { onError(r.error); return; }
    setImageUrl(null);
    onSaved(r.data);
  }

  async function remove() {
    if (!initial.id) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    const r = await service.deleteQuizQuestion(quizId, initial.id);
    if (!r.ok) { onError(r.error); return; }
    onDeleted?.();
  }

  return (
    <form onSubmit={save} aria-label={isNew ? 'Add question' : 'Edit question'} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">{isNew ? 'Add question' : 'Edit question'}</h3>
        {onCancel && (
          <button type="button" onClick={onCancel} aria-label="Cancel" className="rounded p-1 text-gray-500 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="q-statement" className="text-sm font-medium">Statement</label>
        <textarea id="q-statement" rows={3} maxLength={200} value={form.statement} onChange={e => set('statement', e.target.value)} className={field} />
        <p className={`text-xs ${missingToken ? 'text-amber-700' : 'text-gray-600'}`}>
          {missingToken ? 'Add [PET_NAME] so the pet’s name appears.' : <>Shows as: <span className="font-medium text-gray-800">{withPetName(form.statement, 'Biscuit')}</span></>}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="q-dim" className="text-sm font-medium">Dimension</label>
          <select id="q-dim" value={form.dimension}
            onChange={e => { const d = e.target.value as Dimension; setForm(f => ({ ...f, dimension: d, right_pole: DIMENSIONS[d][DIMENSIONS[f.dimension].indexOf(f.right_pole as never)] ?? DIMENSIONS[d][0] })); }}
            className={field}>
            {DIMENSION_ORDER.map(d => <option key={d} value={d}>{DIMENSION_LABELS[d]}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="q-pole" className="text-sm font-medium">Right swipe scores</label>
          <select id="q-pole" value={form.right_pole} onChange={e => set('right_pole', e.target.value as Pole)} className={field}>
            {DIMENSIONS[form.dimension].map(p => <option key={p} value={p}>{poleLabel(p as Pole, animal)}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="q-quote" className="text-sm font-medium">Share quote <span className="font-normal text-gray-600">(optional)</span></label>
        <input id="q-quote" type="text" value={form.share_quote ?? ''} onChange={e => set('share_quote', e.target.value)} className={field} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="q-brief" className="text-sm font-medium">Picture brief</label>
        <input id="q-brief" type="text" value={form.visual_brief ?? ''} onChange={e => set('visual_brief', e.target.value)} className={field} />
      </div>

      {!isNew && (
        <div className="space-y-2">
          <span className="text-sm font-medium">Picture</span>
          <div className="flex items-center gap-3">
            {imageUrl
              ? <img src={imageUrl} alt="Question picture" className="h-24 w-24 rounded-lg object-cover" />
              : <span className="flex h-24 w-24 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-500">No picture</span>}
            <div className="flex flex-col gap-2">
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-60">
                <Upload className="h-4 w-4" aria-hidden="true" /> {uploading ? 'Uploading…' : imageUrl ? 'Replace picture' : 'Upload picture'}
              </button>
              {imageUrl && <button type="button" onClick={removeImage} className="text-left text-sm text-gray-600 underline">Remove picture</button>}
              <span className="text-xs text-gray-600">Breed versions will be made from this picture.</span>
            </div>
          </div>
        </div>
      )}
      {isNew && <p className="text-xs text-gray-600">Save the question first, then add its picture.</p>}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="h-4 w-4 accent-purple-600" />
        Active (asked in the quiz)
      </label>

      <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
        {!isNew ? (
          <button type="button" onClick={remove}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${confirmDelete ? 'bg-red-600 text-white' : 'text-red-700 hover:bg-red-50'}`}>
            <Trash2 className="h-4 w-4" aria-hidden="true" /> {confirmDelete ? 'Click again to delete' : 'Delete'}
          </button>
        ) : <span />}
        <div className="flex items-center gap-3">
          {savedAt && !saving && <span className="text-xs text-green-700" role="status">Saved to draft</span>}
          <button type="submit" disabled={saving} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {saving ? 'Saving…' : isNew ? 'Add to draft' : 'Save to draft'}
          </button>
        </div>
      </div>
    </form>
  );
}
