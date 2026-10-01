/**
 * POST /api/admin/quizzes/[id]/publish — freeze the working draft (active questions + all 16
 * types) as the next version and make it the one customers take. Refused when the publish
 * check has errors; warnings are returned for information.
 */
import { NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { sessionUserId } from '@/lib/quiz/server';
import { checkPublishable, toSnapshotQuestion, toSnapshotType, type AdminQuestionRow, type AdminResultTypeRow } from '@/lib/quiz/admin';

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const supabase = serviceClient();

  const { data: quiz } = await supabase.from('quizzes').select('id, status, current_version').eq('id', id).maybeSingle();
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

  const [{ data: questions }, { data: types }] = await Promise.all([
    supabase.from('quiz_questions').select('*').eq('quiz_id', id).order('sort_order').order('created_at'),
    supabase.from('quiz_result_types').select('*').eq('quiz_id', id).order('code'),
  ]);
  const qs = (questions ?? []) as AdminQuestionRow[];
  const ts = (types ?? []) as AdminResultTypeRow[];
  const check = checkPublishable(qs, ts);
  if (check.errors.length) return NextResponse.json({ error: 'Fix these before publishing', check }, { status: 422 });

  const version = (quiz.current_version || 0) + 1;
  const content = {
    questions: qs.filter(q => q.is_active).map(toSnapshotQuestion),
    resultTypes: ts.map(toSnapshotType),
  };

  const { error: vErr } = await supabase.from('quiz_versions')
    .insert({ quiz_id: id, version, content, published_by: await sessionUserId() });
  if (vErr) {
    const clash = vErr.code === '23505';
    return NextResponse.json({ error: clash ? 'Someone else just published. Reload and try again.' : vErr.message }, { status: clash ? 409 : 500 });
  }

  const { data: updated, error } = await supabase.from('quizzes')
    .update({
      current_version: version,
      has_unpublished_changes: false,
      status: quiz.status === 'draft' ? 'live' : quiz.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ quiz: updated, version, warnings: check.warnings });
}
