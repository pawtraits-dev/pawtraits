/**
 * POST /api/admin/quizzes/[id]/questions — add a question to the working draft.
 * Body: { dimension, right_pole, statement, share_quote?, visual_brief?, is_active? }
 * New questions go to the end. Changes reach customers when the quiz is published.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { parseQuestionInput } from '@/lib/quiz/admin-server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const parsed = parseQuestionInput(body, true);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const supabase = serviceClient();
  const { data: quiz } = await supabase.from('quizzes').select('id').eq('id', id).maybeSingle();
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

  const { data: last } = await supabase.from('quiz_questions').select('sort_order').eq('quiz_id', id)
    .order('sort_order', { ascending: false }).limit(1).maybeSingle();

  const { data, error } = await supabase.from('quiz_questions')
    .insert({ ...parsed.value, quiz_id: id, sort_order: (last?.sort_order ?? 0) + 1 })
    .select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('quizzes').update({ has_unpublished_changes: true, updated_at: new Date().toISOString() }).eq('id', id);
  return NextResponse.json(data, { status: 201 });
}
