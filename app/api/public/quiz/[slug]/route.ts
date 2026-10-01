/**
 * GET /api/public/quiz/[slug]?animal=dog|cat
 * The live (latest published) version of a quiz: questions with picture URLs, and result types
 * so the browser can reveal the type instantly. The server re-scores on submit.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getLiveQuiz, isAnimal, questionImageUrl } from '@/lib/quiz/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const animal = request.nextUrl.searchParams.get('animal');
  if (!isAnimal(animal)) return NextResponse.json({ error: 'animal must be dog or cat' }, { status: 400 });

  try {
    const quiz = await getLiveQuiz(slug, animal);
    if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

    return NextResponse.json({
      slug: quiz.slug,
      animalType: quiz.animalType,
      title: quiz.title,
      version: quiz.version,
      questions: quiz.questions.map(q => ({
        id: q.id,
        dimension: q.dimension,
        rightPole: q.rightPole,
        statement: q.statement,
        imageUrl: questionImageUrl(q.imagePublicId),
        visualBrief: q.visualBrief ?? null,
      })),
      resultTypes: quiz.resultTypes.map(t => ({ code: t.code, name: t.name, tagline: t.tagline ?? null })),
    }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch (err) {
    console.error('quiz GET failed', err);
    return NextResponse.json({ error: 'Could not load the quiz' }, { status: 500 });
  }
}
