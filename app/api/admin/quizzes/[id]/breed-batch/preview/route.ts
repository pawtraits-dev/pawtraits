/**
 * GET /api/admin/quizzes/[id]/breed-batch/preview?kind=question|type&breedId=
 * One breed's versions next to the original pictures, with each one's state.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { sourcesFor, thumbUrl, type BreedRunKind } from '@/lib/quiz/breed-batch';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const kind = request.nextUrl.searchParams.get('kind') as BreedRunKind;
  const breedId = request.nextUrl.searchParams.get('breedId') || '';
  if ((kind !== 'question' && kind !== 'type') || !/^[0-9a-f-]{36}$/i.test(breedId)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const supabase = serviceClient();
  const sources = await sourcesFor(supabase, id, kind);

  // Latest batch item per source (for waiting / failed)
  const col = kind === 'question' ? 'question_id' : 'source_image_id';
  const sourceIds = sources.map(s => (kind === 'question' ? s.questionId! : s.sourceImageId!));
  const { data: items } = sourceIds.length
    ? await supabase.from('quiz_image_run_items').select(`${col}, source_public_id, status, error, created_at`).eq('breed_id', breedId).in(col, sourceIds).order('created_at', { ascending: false })
    : { data: [] as any[] };
  const latest = new Map<string, any>();
  for (const it of items ?? []) { const k = (it as any)[col]; if (!latest.has(k)) latest.set(k, it); }

  const versions = new Map<string, string>(); // source key → version thumb
  if (kind === 'question' && sourceIds.length) {
    const { data } = await supabase.from('quiz_question_breed_images').select('question_id, source_public_id, image_public_id').eq('breed_id', breedId).in('question_id', sourceIds);
    const current = new Map(sources.map(s => [s.questionId, s.publicId]));
    for (const r of data ?? []) if (current.get(r.question_id) === r.source_public_id) versions.set(r.question_id, thumbUrl(r.image_public_id, 240)!);
  } else if (sourceIds.length) {
    const { data } = await supabase.from('quiz_breed_images').select('source_image_id, image_id, status').eq('breed_id', breedId).in('source_image_id', sourceIds).eq('status', 'done');
    const imgIds = (data ?? []).map(r => r.image_id).filter(Boolean);
    const { data: imgs } = imgIds.length ? await supabase.from('image_catalog').select('id, cloudinary_public_id').in('id', imgIds) : { data: [] as any[] };
    const pid = new Map((imgs ?? []).map((i: any) => [i.id, i.cloudinary_public_id]));
    const keyFor = new Map(sources.map(s => [s.sourceImageId, s.key]));
    for (const r of data ?? []) if (pid.get(r.image_id)) versions.set(keyFor.get(r.source_image_id)!, thumbUrl(pid.get(r.image_id), 240)!);
  }

  return NextResponse.json({
    items: sources.map(s => {
      const sid = kind === 'question' ? s.questionId! : s.sourceImageId!;
      const it = latest.get(sid);
      const version = versions.get(s.key) ?? null;
      const state = version ? 'done' : it && it.source_public_id === s.publicId && ['queued', 'submitted'].includes(it.status) ? 'waiting'
        : it && it.source_public_id === s.publicId && it.status === 'failed' ? 'failed' : 'missing';
      return { key: s.key, label: s.label, original: thumbUrl(s.publicId, 240), version, state, error: state === 'failed' ? it?.error ?? null : null };
    }),
  });
}
