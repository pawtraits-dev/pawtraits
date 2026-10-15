/**
 * Breed versions of quiz pictures, made with the Gemini Batch API (lib/quiz/breed-batch.ts).
 *
 * GET  ?kind=question|type&top=20
 *      Top breeds for the quiz's species, the pictures that can get breed versions, how many
 *      versions each breed has, the cost per picture, and recent runs.
 * POST { kind, breedIds, confirm? }        without confirm: the plan and cost; with it: start the run
 * POST { action: 'cancel', runId }         stop a run
 * POST { action: 'redo', kind, breedId, sourceKey }  drop one version so the next run remakes it
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { cancelBreedRun, createBreedRun, perImageCost, planBreedRun, SIZE_FOR, sourcesFor, takenKeys, thumbUrl, type BreedRunKind } from '@/lib/quiz/breed-batch';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isKind = (k: unknown): k is BreedRunKind => k === 'question' || k === 'type';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const kind = request.nextUrl.searchParams.get('kind') || 'question';
  if (!isKind(kind)) return NextResponse.json({ error: 'kind must be question or type' }, { status: 400 });
  const top = Math.min(300, Math.max(1, Number(request.nextUrl.searchParams.get('top')) || 20));
  const supabase = serviceClient();

  const { data: quiz } = await supabase.from('quizzes').select('id, animal_type').eq('id', id).maybeSingle();
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

  const [{ data: allBreeds }, sources, { data: runs }] = await Promise.all([
    supabase.from('breeds').select('id, name, popularity_rank').eq('animal_type', quiz.animal_type).eq('is_active', true)
      .order('popularity_rank', { ascending: true, nullsFirst: false }).order('name'),
    sourcesFor(supabase, id, kind),
    supabase.from('quiz_image_runs').select('id, kind, image_size, status, item_count, estimated_cost_usd, created_at, completed_at')
      .eq('quiz_id', id).eq('kind', kind).order('created_at', { ascending: false }).limit(10),
  ]);
  const breeds = allBreeds ?? [];
  const topIds = breeds.slice(0, top).map(b => b.id);

  // Versions per breed (existing or on their way), for every breed so picks beyond the top N show too
  const taken = await takenKeys(supabase, kind, sources, breeds.map(b => b.id));
  const coverage: Record<string, number> = {};
  for (const key of Array.from(taken)) { const b = key.split(':').pop()!; coverage[b] = (coverage[b] ?? 0) + 1; }

  // Run progress
  const runIds = (runs ?? []).map(r => r.id);
  const counts: Record<string, Record<string, number>> = {};
  if (runIds.length) {
    const { data: items } = await supabase.from('quiz_image_run_items').select('run_id, status').in('run_id', runIds);
    for (const it of items ?? []) { counts[it.run_id] ??= {}; counts[it.run_id][it.status] = (counts[it.run_id][it.status] ?? 0) + 1; }
  }

  return NextResponse.json({
    animal: quiz.animal_type, kind, imageSize: SIZE_FOR[kind], perImageUsd: perImageCost(kind),
    breeds: breeds.map(b => ({ id: b.id, name: b.name, rank: b.popularity_rank })), topIds,
    sources: sources.map(s => ({ key: s.key, label: s.label, thumb: thumbUrl(s.publicId, 160) })),
    coverage,
    runs: (runs ?? []).map(r => ({ ...r, counts: counts[r.id] ?? {} })),
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const supabase = serviceClient();

  if (body.action === 'cancel') {
    if (!UUID_RE.test(body.runId || '')) return NextResponse.json({ error: 'Invalid run' }, { status: 400 });
    const { data: run } = await supabase.from('quiz_image_runs').select('id').eq('id', body.runId).eq('quiz_id', id).maybeSingle();
    if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    await cancelBreedRun(supabase, run.id);
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'redo') {
    if (!isKind(body.kind) || !UUID_RE.test(body.breedId || '') || typeof body.sourceKey !== 'string') return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    if (body.kind === 'question') {
      const { data: q } = await supabase.from('quiz_questions').select('id').eq('id', body.sourceKey).eq('quiz_id', id).maybeSingle();
      if (!q) return NextResponse.json({ error: 'Question not found' }, { status: 404 });
      await supabase.from('quiz_question_breed_images').delete().eq('question_id', q.id).eq('breed_id', body.breedId);
    } else {
      const { data: t } = await supabase.from('quiz_result_types').select('design_image_id').eq('quiz_id', id).eq('code', body.sourceKey).maybeSingle();
      if (!t?.design_image_id) return NextResponse.json({ error: 'Type not found' }, { status: 404 });
      const { data: row } = await supabase.from('quiz_breed_images').select('id, image_id').eq('source_image_id', t.design_image_id).eq('breed_id', body.breedId).maybeSingle();
      if (row) {
        if (row.image_id) await supabase.from('image_catalog').update({ is_public: false }).eq('id', row.image_id); // retire the old one
        await supabase.from('quiz_breed_images').delete().eq('id', row.id);
      }
    }
    return NextResponse.json({ ok: true });
  }

  if (!isKind(body.kind)) return NextResponse.json({ error: 'kind must be question or type' }, { status: 400 });
  const breedIds: string[] = Array.isArray(body.breedIds) ? Array.from(new Set(body.breedIds.filter((b: unknown) => typeof b === 'string' && UUID_RE.test(b)))) : [];
  if (!breedIds.length) return NextResponse.json({ error: 'Choose at least one breed' }, { status: 400 });
  if (breedIds.length > 300) return NextResponse.json({ error: 'Up to 300 breeds at a time' }, { status: 400 });
  const { data: quiz } = await supabase.from('quizzes').select('animal_type').eq('id', id).maybeSingle();
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
  const { data: okBreeds } = await supabase.from('breeds').select('id').in('id', breedIds).eq('animal_type', quiz.animal_type);
  const valid = (okBreeds ?? []).map(b => b.id);

  try {
    if (!body.confirm) {
      const p = await planBreedRun(supabase, id, body.kind, valid);
      return NextResponse.json({ ...p, make: p.make.length });
    }
    const { run, planned } = await createBreedRun(supabase, id, body.kind, valid);
    return NextResponse.json({ run, ...planned, make: planned.make.length });
  } catch (e: any) {
    console.error('Quiz breed batch failed', e);
    return NextResponse.json({ error: e?.message || 'Could not start the run' }, { status: 500 });
  }
}
