/**
 * Pawsonality result page (server shell): title and link preview per result; the body is
 * components/quiz/ResultView (picture, share, scores, make-a-Pawtrait, save). Link preview
 * image: ./opengraph-image.tsx.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import UserAwareNavigation from '@/components/UserAwareNavigation';
import { getPublicResult } from '@/lib/quiz/results';
import ResultView from '@/components/quiz/ResultView';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const r = await getPublicResult(code).catch(() => null);
  if (!r) return { title: 'Pawsonality result | Pawtraits', robots: { index: false } };
  const title = `${r.petName} is ${r.type?.name ?? r.code}`;
  return {
    title: `${title} | Pawtraits`,
    description: `${r.code}${r.type?.tagline ? ` · ${r.type.tagline}` : ''}. What's your pet's Pawsonality? Take the free quiz.`,
    robots: { index: false, follow: true },
    openGraph: { title, description: "What's your pet's Pawsonality? Take the free 90-second quiz.", siteName: 'Pawtraits', locale: 'en_GB' },
  };
}

export default async function PawsonalityResultPage({ params }: Props) {
  const { code } = await params;
  const r = await getPublicResult(code);
  if (!r) notFound();
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <UserAwareNavigation />
      <ResultView r={r} />
    </div>
  );
}
