/**
 * PATCH  /api/admin/quizzes/[id]/questions/[questionId] — edit a draft question (any subset of
 *        dimension, right_pole, statement, share_quote, visual_brief, is_active, sort_order)
 * DELETE /api/admin/quizzes/[id]/questions/[questionId] — remove it from the draft. Published
 *        versions keep their own copy, so past results are unaffected.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { parseQuestionInput } from '@/lib/quiz/admin-server';
import { DIMENSIONS } from '@/lib/quiz/types';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string; questionId: string }> };

async function markChanged(quizId: string) {
  await serviceClient().from('quizzes').update({ has_unpublished_changes: true, updated_at: new Date().toISOString() }).eq('id', quizId);
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id, questionId } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = parseQuestionInput(body, false);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const supabase = serviceClient();
  const { data: current } = await supabase.from('quiz_questions').select('dimension, right_pole')
    .eq('id', questionId).eq('quiz_id', id).maybeSingle();
  if (!current) return NextResponse.json({ error: 'Question not found' }, { status: 404 });

  // Changing the dimension alone: keep the same side of the new dimension (first/second pole)
  const update: Record<string, unknown> = { ...parsed.value, updated_at: new Date().toISOString() };
  if (parsed.value.dimension && !parsed.value.right_pole && parsed.value.dimension !== current.dimension) {
    const oldIdx = (DIMENSIONS as any)[current.dimension].indexOf(current.right_pole);
    update.right_pole = (DIMENSIONS as any)[parsed.value.dimension][Math.max(0, oldIdx)];
  }

  const { data, error } = await supabase.from('quiz_questions').update(update)
    .eq('id', questionId).eq('quiz_id', id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await markChanged(id);
  return NextResponse.json(data);
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id, questionId } = await params;
  const { error, count } = await serviceClient().from('quiz_questions').delete({ count: 'exact' })
    .eq('id', questionId).eq('quiz_id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!count) return NextResponse.json({ error: 'Question not found' }, { status: 404 });
  await markChanged(id);
  return NextResponse.json({ ok: true });
}
