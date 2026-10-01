/**
 * GET /api/public/quiz-results/[code]
 * A saved result for its share page: pet name, species, breed, type copy (from the version it
 * was scored on) and the four dimension scores. No email, user or IP details.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getPublicResult } from '@/lib/quiz/results';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  try {
    const result = await getPublicResult(code);
    if (!result) return NextResponse.json({ error: 'Result not found' }, { status: 404 });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600' } });
  } catch (err) {
    console.error('quiz result GET failed', err);
    return NextResponse.json({ error: 'Could not load the result' }, { status: 500 });
  }
}
