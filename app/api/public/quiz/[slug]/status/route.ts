/**
 * GET /api/public/quiz/[slug]/status → { dog: boolean, cat: boolean }
 * Which species' quizzes are live. The ways in (home band, My pets prompt) show only when live,
 * so pausing a quiz in admin hides them.
 */
import { NextResponse } from 'next/server';
import { liveAnimals } from '@/lib/quiz/ways-in';

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const live = await liveAnimals(slug);
    return NextResponse.json(live, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch (err) {
    console.error('quiz status failed', err);
    return NextResponse.json({ dog: false, cat: false });
  }
}
