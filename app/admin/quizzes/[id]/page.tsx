'use client';

/**
 * Admin → Quizzes → one quiz: questions, result types and results, with Publish and Pause.
 * Edits save to the draft; Publish freezes the draft as the next version customers take.
 * Data: /api/admin/quizzes/[id] and friends, via AdminSupabaseService.
 */
import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ChevronLeft } from 'lucide-react';
import { AdminSupabaseService } from '@/lib/admin-supabase';
import { checkPublishable, type AdminResultTypeRow } from '@/lib/quiz/admin';
import StatusChip from '@/components/admin/quiz/StatusChip';
import QuestionsTab, { type QuestionRow } from '@/components/admin/quiz/QuestionsTab';
import ResultTypesTab from '@/components/admin/quiz/ResultTypesTab';
import ResultsTab from '@/components/admin/quiz/ResultsTab';

type Tab = 'questions' | 'types' | 'results';

interface QuizMeta {
  id: string; slug: string; animal_type: 'dog' | 'cat'; title: string;
  status: 'draft' | 'live' | 'paused'; current_version: number; has_unpublished_changes: boolean;
}

export default function QuizEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [quiz, setQuiz] = useState<QuizMeta | null>(null);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [types, setTypes] = useState<AdminResultTypeRow[]>([]);
  const [siblings, setSiblings] = useState<QuizMeta[]>([]);
  const [tab, setTab] = useState<Tab>('questions');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const service = new AdminSupabaseService();
      const [r, list] = await Promise.all([service.getQuiz(id), service.getQuizzes()]);
      if (!r.ok) { setError(r.error); setLoaded(true); return; }
      setQuiz(r.data.quiz); setQuestions(r.data.questions); setTypes(r.data.resultTypes);
      if (list.ok) setSiblings((list.data as QuizMeta[]).filter(q => q.slug === r.data.quiz.slug && q.id !== id));
      setLoaded(true);
    })();
  }, [id]);

  const check = useMemo(() => checkPublishable(questions, types), [questions, types]);

  // Any edit in a tab means there are unpublished changes
  const markChanged = () => setQuiz(q => (q ? { ...q, has_unpublished_changes: true } : q));

  async function publish() {
    if (!quiz) return;
    setBusy(true); setNotice(null);
    const r = await new AdminSupabaseService().publishQuiz(quiz.id);
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setError(null);
    setQuiz(r.data.quiz);
    setNotice(`Version ${r.data.version} is live. Customers starting the quiz now get it; results already taken keep their version.`);
  }

  async function toggleLive() {
    if (!quiz) return;
    setBusy(true);
    const r = await new AdminSupabaseService().updateQuiz(quiz.id, { status: quiz.status === 'live' ? 'paused' : 'live' });
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setError(null); setQuiz(r.data);
  }

  if (!loaded) return <div className="p-6 text-gray-600">Loading…</div>;
  if (!quiz) return <div className="p-6"><div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error ?? 'Quiz not found'}</div></div>;

  const activeCount = questions.filter(q => q.is_active).length;

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/quizzes" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Quizzes
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">{quiz.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <StatusChip status={quiz.status} version={quiz.current_version} />
            {quiz.has_unpublished_changes && <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Unpublished changes</span>}
            {siblings.map(s => (
              <Link key={s.id} href={`/admin/quizzes/${s.id}`} className="text-purple-700 underline">Switch to {s.animal_type === 'cat' ? 'cats' : 'dogs'}</Link>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          {quiz.current_version > 0 && (
            <button type="button" onClick={toggleLive} disabled={busy}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60">
              {quiz.status === 'live' ? 'Pause quiz' : 'Go live'}
            </button>
          )}
          <button type="button" onClick={publish} disabled={busy || check.errors.length > 0 || !quiz.has_unpublished_changes}
            title={!quiz.has_unpublished_changes ? 'Nothing new to publish' : check.errors.length ? 'Fix the problems listed first' : undefined}
            className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-bold text-white hover:bg-purple-800 disabled:opacity-50">
            Publish version {quiz.current_version + 1}
          </button>
        </div>
      </div>

      {error && <div role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
      {notice && <div role="status" className="flex items-start gap-2 rounded border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{notice}</div>}

      {(check.errors.length > 0 || check.warnings.length > 0) && (
        <details className="rounded-xl border border-gray-200 bg-white px-4 py-3" open={check.errors.length > 0}>
          <summary className="cursor-pointer text-sm font-semibold text-gray-900">
            {check.errors.length > 0 ? `${check.errors.length} to fix before publishing` : 'Ready to publish'}
            {check.warnings.length > 0 && <span className="font-normal text-gray-600"> · {check.warnings.length} note{check.warnings.length === 1 ? '' : 's'}</span>}
          </summary>
          <ul className="mt-2 space-y-1 text-sm">
            {check.errors.map(e => <li key={e} className="flex gap-2 text-red-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{e}</li>)}
            {check.warnings.map(w => <li key={w} className="flex gap-2 text-amber-800"><span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />{w}</li>)}
          </ul>
        </details>
      )}

      <div role="tablist" aria-label="Quiz sections" className="flex gap-1 border-b border-gray-200">
        {([['questions', `Questions (${activeCount})`], ['types', `Result types (${types.length})`], ['results', 'Results']] as [Tab, string][]).map(([key, label]) => (
          <button key={key} role="tab" type="button" aria-selected={tab === key} onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm ${tab === key ? 'border-purple-600 font-semibold text-purple-800' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === 'questions' && (
          <QuestionsTab quizId={quiz.id} animal={quiz.animal_type} questions={questions}
            onChange={next => { setQuestions(next); markChanged(); }} onError={setError} />
        )}
        {tab === 'types' && (
          <ResultTypesTab quizId={quiz.id} animal={quiz.animal_type} types={types}
            onChange={next => { setTypes(next); markChanged(); }} onError={setError} />
        )}
        {tab === 'results' && <ResultsTab quizId={quiz.id} slug={quiz.slug} types={types} />}
      </div>
    </div>
  );
}
