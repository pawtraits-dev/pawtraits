/**
 * GET  /api/admin/quizzes/[id]/breed-images?top=20
 *      The top N breeds for the quiz's species (by popularity rank), the result types that have
 *      a Pawsonalities design linked, and the breed-picture jobs for those designs.
 * POST /api/admin/quizzes/[id]/breed-images  { code, breedId }
 *      Make (or retry) one breed picture now. Takes 20–60 s; the admin page calls this one at a
 *      time to fill the grid. Uses the design linked in the draft (publish so customers see it).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { ensureBreedImage } from '@/lib/quiz/breed-images';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const top = Math.min(200, Math.max(1, Number(request.nextUrl.searchParams.get('top')) || 20));
  const supabase = serviceClient();

  const { data: quiz } = await supabase.from('quizzes').select('id, animal_type').eq('id', id).maybeSingle();
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

  const [{ data: breeds }, { data: types }] = await Promise.all([
    supabase.from('breeds').select('id, name, popularity_rank').eq('animal_type', quiz.animal_type).eq('is_active', true)
      .order('popularity_rank', { ascending: true, nullsFirst: false }).order('name').limit(top),
    supabase.from('quiz_result_types').select('code, name, design_image_id').eq('quiz_id', id).not('design_image_id', 'is', null).order('code'),
  ]);

  const designIds = (types ?? []).map(t => t.design_image_id);
  const { data: jobs } = designIds.length
    ? await supabase.from('quiz_breed_images').select('type_code, breed_id, source_image_id, image_id, status, error, updated_at')
        .in('source_image_id', designIds).in('breed_id', (breeds ?? []).map(b => b.id))
    : { data: [] as any[] };

  return NextResponse.json({ animal: quiz.animal_type, breeds: breeds ?? [], types: types ?? [], jobs: jobs ?? [] });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (!/^[EI][SN][TF][BC]$/.test(body?.code || '') || !UUID_RE.test(body?.breedId || '')) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const supabase = serviceClient();
  const [{ data: quiz }, { data: type }, { data: breed }] = await Promise.all([
    supabase.from('quizzes').select('animal_type').eq('id', id).maybeSingle(),
    supabase.from('quiz_result_types').select('design_image_id').eq('quiz_id', id).eq('code', body.code).maybeSingle(),
    supabase.from('breeds').select('id, animal_type').eq('id', body.breedId).maybeSingle(),
  ]);
  if (!quiz || !type) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!type.design_image_id) return NextResponse.json({ error: 'Link a design to this type first' }, { status: 409 });
  if (!breed || breed.animal_type !== quiz.animal_type) return NextResponse.json({ error: 'Breed does not match the quiz' }, { status: 400 });

  const result = await ensureBreedImage({
    animal: quiz.animal_type, code: body.code, breedId: body.breedId, sourceImageId: type.design_image_id, requestedBy: 'admin',
  });
  return NextResponse.json(result);
}
