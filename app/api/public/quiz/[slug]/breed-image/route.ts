/**
 * POST /api/public/quiz/[slug]/breed-image  { animal, code, breedId, shareCode?, peek? }
 * The pet's type painted as their breed. Starts the picture if nobody has (the quiz calls this
 * as soon as all four letters are settled, a few swipes before the end), waits for it when it
 * started it, otherwise answers 'pending' at once. When done and a shareCode is given, links the
 * picture to that result. `peek: true` never starts anything (used for polling).
 * → { status: 'done', imageId } | { status: 'pending' } | { status: 'failed' } | { status: 'unavailable' }
 * New pictures from one IP are capped at 10 an hour; each design + breed is only ever made once.
 */
import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';
import { getLiveQuiz, hashIp, isAnimal } from '@/lib/quiz/server';
import { ensureBreedImage, peekBreedImage } from '@/lib/quiz/breed-images';
import { getClientIp } from '@/lib/public-rate-limiter';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // Gemini at 2K takes 20–60 s

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NEW_PER_HOUR = 10;

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await request.json().catch(() => ({}));
  const { animal, code, breedId, shareCode, peek } = body ?? {};
  if (!isAnimal(animal) || typeof code !== 'string' || !/^[EI][SN][TF][BC]$/.test(code) || typeof breedId !== 'string' || !UUID_RE.test(breedId)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  try {
    const quiz = await getLiveQuiz(slug, animal);
    const design = quiz?.resultTypes.find(t => t.code === code)?.designImageId;
    if (!design) return NextResponse.json({ status: 'unavailable', reason: 'no-design' });

    const supabase = serviceClient();
    const { data: breed } = await supabase.from('breeds').select('id, animal_type').eq('id', breedId).maybeSingle();
    if (!breed || breed.animal_type !== animal) return NextResponse.json({ status: 'unavailable', reason: 'breed' });

    let result = await peekBreedImage(design, breedId);
    if (!result && !peek) {
      const ipHash = hashIp(getClientIp(request.headers));
      const since = new Date(Date.now() - 3600_000).toISOString();
      const { count } = await supabase.from('quiz_breed_images').select('id', { count: 'exact', head: true })
        .eq('ip_hash', ipHash).gte('created_at', since);
      result = (count ?? 0) >= NEW_PER_HOUR
        ? { status: 'unavailable', reason: 'busy' }
        : await ensureBreedImage({ animal, code, breedId, sourceImageId: design, requestedBy: 'quiz', ipHash });
    }
    result ??= { status: 'pending' };

    if (result.status === 'done' && typeof shareCode === 'string' && /^[a-z0-9]{8,12}$/.test(shareCode)) {
      await supabase.from('quiz_results').update({ result_image_id: result.imageId })
        .eq('share_code', shareCode).eq('result_type', code).eq('breed_id', breedId).is('result_image_id', null);
    }
    return NextResponse.json(result.status === 'failed' ? { status: 'failed' } : result);
  } catch (err) {
    console.error('breed-image failed', err);
    return NextResponse.json({ status: 'failed' }, { status: 500 });
  }
}
