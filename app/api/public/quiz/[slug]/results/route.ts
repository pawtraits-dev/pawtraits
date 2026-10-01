/**
 * POST /api/public/quiz/[slug]/results
 * Body: { animal, petName, breedId?, answers: { questionId: 'right'|'left' }, order?: string[],
 *         partnerCode?, referralCode? }
 * Scores the answers against the live version (never trusts a browser score), saves the result
 * and returns its share code. No sign-up needed; a signed-in customer's user id is attached.
 * Limit: 30 completed quizzes per IP per hour.
 */
import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';
import { getLiveQuiz, hashIp, isAnimal, newShareCode, sessionUserId } from '@/lib/quiz/server';
import { scoreQuiz, validateAnswers } from '@/lib/quiz/scoring';
import { findBreedImage } from '@/lib/quiz/breed-images';
import { getClientIp } from '@/lib/public-rate-limiter';

const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ '’.-]{0,29}$/;
const CODE_RE = /^[A-Za-z0-9_-]{2,40}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PER_HOUR = 30;

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const animal = body?.animal;
  const petName = typeof body?.petName === 'string' ? body.petName.trim() : '';
  if (!isAnimal(animal)) return NextResponse.json({ error: 'animal must be dog or cat' }, { status: 400 });
  if (!NAME_RE.test(petName)) return NextResponse.json({ error: "Please give your pet's name (letters only, up to 30)" }, { status: 400 });

  try {
    const quiz = await getLiveQuiz(slug, animal);
    if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    if (!validateAnswers(quiz.questions, body.answers)) {
      return NextResponse.json({ error: 'Please answer every question', version: quiz.version }, { status: 409 });
    }

    const supabase = serviceClient();
    const ipHash = hashIp(getClientIp(request.headers));
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await supabase.from('quiz_results').select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash).gte('completed_at', since);
    if ((count ?? 0) >= PER_HOUR) {
      return NextResponse.json({ error: 'Lots of quizzes from here! Please try again in a little while.' }, { status: 429 });
    }

    // Breed must exist and match the species; otherwise it's ignored rather than failing the quiz
    let breedId: string | null = null;
    if (typeof body.breedId === 'string' && UUID_RE.test(body.breedId)) {
      const { data: breed } = await supabase.from('breeds').select('id, animal_type').eq('id', body.breedId).maybeSingle();
      if (breed && breed.animal_type === animal) breedId = breed.id;
    }

    const ids = new Set(quiz.questions.map(q => q.id));
    const order: string[] = Array.isArray(body.order) ? body.order.filter((x: unknown) => typeof x === 'string' && ids.has(x)) : [];
    const score = scoreQuiz(quiz.questions, body.answers, order);
    const userId = await sessionUserId();
    // Breed version already made (top breeds, or painted while they answered): show it straight away
    const design = quiz.resultTypes.find(t => t.code === score.code)?.designImageId;
    const resultImageId = design && breedId ? await findBreedImage(design, breedId) : null;

    for (let attempt = 0; attempt < 3; attempt++) {
      const shareCode = newShareCode();
      const { error } = await supabase.from('quiz_results').insert({
        share_code: shareCode,
        quiz_id: quiz.quizId,
        quiz_type: quiz.slug,
        quiz_version: quiz.version,
        animal_type: animal,
        pet_name: petName,
        breed_id: breedId,
        user_id: userId,
        answers: body.answers,
        answer_order: order,
        score_data: score.scoreData,
        result_type: score.code,
        partner_code: typeof body.partnerCode === 'string' && CODE_RE.test(body.partnerCode) ? body.partnerCode : null,
        referral_code: typeof body.referralCode === 'string' && CODE_RE.test(body.referralCode) ? body.referralCode.toUpperCase() : null,
        ip_hash: ipHash,
        result_image_id: resultImageId,
      });
      if (!error) return NextResponse.json({ shareCode, code: score.code });
      if (error.code !== '23505') throw error; // retry only on a share-code clash
    }
    throw new Error('Could not allocate a share code');
  } catch (err) {
    console.error('quiz result save failed', err);
    return NextResponse.json({ error: 'Could not save the result' }, { status: 500 });
  }
}
