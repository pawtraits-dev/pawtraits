'use client';

/**
 * Admin → Quizzes: one card per quiz and species, linking to the editor.
 * Data: GET /api/admin/quizzes (via AdminSupabaseService).
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, ChevronRight } from 'lucide-react';
import { AdminSupabaseService } from '@/lib/admin-supabase';
import StatusChip from '@/components/admin/quiz/StatusChip';

interface QuizRow {
  id: string; slug: string; animal_type: 'dog' | 'cat'; title: string;
  status: 'draft' | 'live' | 'paused'; current_version: number; has_unpublished_changes: boolean;
  question_count: number; active_question_count: number; result_count: number;
}

export default function QuizzesPage() {
  const [quizzes, setQuizzes] = useState<QuizRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const result = await new AdminSupabaseService().getQuizzes();
      if (result.ok) setQuizzes(result.data as QuizRow[]);
      else setError(result.status === 500 && /quizzes/.test(result.error)
        ? 'The quiz tables are not in the database yet. Run db/migrations/2026-10-01-quiz-engine.sql and the seed file in Supabase.'
        : result.error);
    })();
  }, []);

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Sparkles className="w-6 h-6" aria-hidden="true" /> Quizzes</h1>
        <p className="text-gray-600 mt-1">
          Edit questions, pictures and result types. Changes are saved as a draft and reach customers when you publish a new version; results already taken keep the version they were scored on.
        </p>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {!quizzes && !error && <p className="text-gray-600">Loading…</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {quizzes?.map(q => (
          <Link key={q.id} href={`/admin/quizzes/${q.id}`}
            className="group rounded-xl border border-gray-200 bg-white p-5 hover:border-purple-300 hover:shadow-sm transition">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{q.title}</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusChip status={q.status} version={q.current_version} />
                  {q.has_unpublished_changes && (
                    <span className="inline-flex rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Unpublished changes</span>
                  )}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-purple-600" aria-hidden="true" />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div><dt className="text-gray-600">Questions</dt><dd className="font-semibold">{q.active_question_count} active{q.question_count > q.active_question_count ? ` (${q.question_count - q.active_question_count} off)` : ''}</dd></div>
              <div><dt className="text-gray-600">Completed</dt><dd className="font-semibold">{q.result_count.toLocaleString('en-GB')}</dd></div>
            </dl>
          </Link>
        ))}
      </div>
    </div>
  );
}
