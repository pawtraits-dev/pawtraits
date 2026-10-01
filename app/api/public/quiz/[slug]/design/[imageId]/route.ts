/**
 * GET /api/public/quiz/[slug]/design/[imageId]
 * → { code, name, tagline, animal } when the design is a Pawsonality type's design (or a breed
 *   version of one) and that quiz is live; 404 otherwise. Used by the design page to say
 *   "This is The Snack Negotiator, one of 16 Pawsonalities" and link to the quiz.
 */
import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; imageId: string }> }) {
  const { slug, imageId } = await params;
  if (!UUID_RE.test(imageId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const supabase = serviceClient();
  try {
    // A breed version points back at its type design
    const { data: breedVersion } = await supabase.from('quiz_breed_images')
      .select('source_image_id').eq('image_id', imageId).eq('status', 'done').limit(1).maybeSingle();
    const designId = breedVersion?.source_image_id ?? imageId;

    const { data: rows } = await supabase.from('quiz_result_types')
      .select('code, name, tagline, quizzes:quiz_id (slug, animal_type, status, current_version)')
      .eq('design_image_id', designId);
    const match = (rows ?? []).find((r: any) => r.quizzes?.slug === slug && r.quizzes?.status === 'live' && r.quizzes?.current_version > 0) as any;
    if (!match) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json(
      { code: match.code, name: match.name, tagline: match.tagline ?? null, animal: match.quizzes.animal_type },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
    );
  } catch (err) {
    console.error('quiz design lookup failed', err);
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
