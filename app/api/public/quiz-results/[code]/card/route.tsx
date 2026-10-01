/**
 * GET /api/public/quiz-results/[code]/card?format=story|og
 * PNG share card for a result (story = 1080×1920 for Stories/status; og = 1200×630 link preview).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getPublicResult } from '@/lib/quiz/results';
import { renderResultCard } from '@/lib/quiz/card';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const format = request.nextUrl.searchParams.get('format') === 'og' ? 'og' : 'story';
  const result = await getPublicResult(code).catch(() => null);
  if (!result) return NextResponse.json({ error: 'Result not found' }, { status: 404 });
  const image = await renderResultCard(result, format);
  // Cache briefly: the picture can upgrade to the breed version shortly after the quiz
  image.headers.set('Cache-Control', result.imageKind === 'breed' ? 'public, max-age=86400, s-maxage=604800' : 'public, max-age=60, s-maxage=60');
  image.headers.set('Content-Disposition', `inline; filename="${result.petName.replace(/[^A-Za-z0-9]+/g, '-')}-pawsonality.png"`);
  return image;
}
