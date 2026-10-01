'use client';

/**
 * On a design page: when the design is one of the Pawsonality type designs (or a breed version
 * of one) and the quiz is live, says which type it is and links to the quiz (phase 5 way in).
 * Only asks the server for designs in a Pawsonalities theme; hidden when they came from their result.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface TypeInfo { code: string; name: string; tagline: string | null; animal: 'dog' | 'cat' }

export default function DesignQuizLink({ imageId, themeName }: { imageId: string; themeName?: string | null }) {
  const [info, setInfo] = useState<TypeInfo | null>(null);
  const relevant = !!themeName && /pawsonalit/i.test(themeName);

  useEffect(() => {
    if (!relevant) return;
    // Already came from their quiz result
    if (new URLSearchParams(window.location.search).get('src') === 'pawsonality') return;
    fetch(`/api/public/quiz/pawsonality/design/${imageId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => setInfo(d?.code ? d : null))
      .catch(() => setInfo(null));
  }, [imageId, relevant]);

  if (!info) return null;
  return (
    <Link href={`/quiz/pawsonality?animal=${info.animal}&src=design`}
      className="mt-4 flex items-center gap-3 rounded-2xl border border-purple-200 bg-white p-4 hover:border-purple-400">
      <span className="flex h-10 shrink-0 items-center rounded-md bg-gray-900 px-2 text-sm font-bold tracking-[0.08em] text-white">{info.code}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-gray-900">{info.name}, one of 16 Pawsonalities</span>
        <span className="block text-sm text-gray-600">Is this your {info.animal}? Find out in 20 swipes.</span>
      </span>
      <ArrowRight className="h-5 w-5 shrink-0 text-purple-700" aria-hidden="true" />
    </Link>
  );
}
