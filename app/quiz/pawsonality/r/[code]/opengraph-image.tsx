/** Link preview image for a result page (1200×630) */
import { getPublicResult } from '@/lib/quiz/results';
import { CARD_SIZES, renderResultCard } from '@/lib/quiz/card';

export const size = CARD_SIZES.og;
export const contentType = 'image/png';
export const alt = 'Pawsonality result';

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const result = await getPublicResult(code).catch(() => null);
  if (!result) return new Response('Not found', { status: 404 });
  return renderResultCard(result, 'og');
}
