/**
 * GET   /api/admin/quizzes/[id] — quiz, all questions (incl. switched off), result types,
 *                                 and the publish check for the working draft.
 * PATCH /api/admin/quizzes/[id] — { status: 'live' | 'paused', title? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { checkPublishable, cleanText, type AdminQuestionRow, type AdminResultTypeRow } from '@/lib/quiz/admin';
import { questionImageUrl } from '@/lib/quiz/server';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const supabase = serviceClient();

  const { data: quiz, error } = await supabase.from('quizzes').select('*').eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

  const [{ data: questions }, { data: types }, { data: versions }] = await Promise.all([
    supabase.from('quiz_questions').select('*').eq('quiz_id', id).order('sort_order').order('created_at'),
    supabase.from('quiz_result_types').select('*').eq('quiz_id', id).order('code'),
    supabase.from('quiz_versions').select('version, published_at').eq('quiz_id', id).order('version', { ascending: false }).limit(10),
  ]);

  return NextResponse.json({
    quiz,
    questions: (questions ?? []).map(q => ({ ...q, image_url: questionImageUrl(q.image_public_id, 400) })),
    resultTypes: types ?? [],
    versions: versions ?? [],
    check: checkPublishable((questions ?? []) as AdminQuestionRow[], (types ?? []) as AdminResultTypeRow[]),
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.status !== undefined) {
    if (!['live', 'paused'].includes(body.status)) return NextResponse.json({ error: 'status must be live or paused' }, { status: 400 });
    update.status = body.status;
  }
  if (body.title !== undefined) {
    const title = cleanText(body.title, 80);
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    update.title = title;
  }

  const supabase = serviceClient();
  if (update.status === 'live') {
    const { data: q } = await supabase.from('quizzes').select('current_version').eq('id', id).maybeSingle();
    if (!q?.current_version) return NextResponse.json({ error: 'Publish a version before going live' }, { status: 409 });
  }
  const { data, error } = await supabase.from('quizzes').update(update).eq('id', id).select('*').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
  return NextResponse.json(data);
}
