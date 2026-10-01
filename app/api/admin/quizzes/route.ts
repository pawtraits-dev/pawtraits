/**
 * GET /api/admin/quizzes — every quiz with status, version, question counts and completions.
 */
import { NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const supabase = serviceClient();

  const { data: quizzes, error } = await supabase
    .from('quizzes')
    .select('id, slug, animal_type, title, status, current_version, has_unpublished_changes, updated_at')
    .order('slug').order('animal_type');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const out = await Promise.all((quizzes ?? []).map(async q => {
    const [{ count: questions }, { count: active }, { count: results }] = await Promise.all([
      supabase.from('quiz_questions').select('id', { count: 'exact', head: true }).eq('quiz_id', q.id),
      supabase.from('quiz_questions').select('id', { count: 'exact', head: true }).eq('quiz_id', q.id).eq('is_active', true),
      supabase.from('quiz_results').select('id', { count: 'exact', head: true }).eq('quiz_id', q.id),
    ]);
    return { ...q, question_count: questions ?? 0, active_question_count: active ?? 0, result_count: results ?? 0 };
  }));

  return NextResponse.json(out);
}
