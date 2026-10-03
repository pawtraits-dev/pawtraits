'use client';

/**
 * Under the design title: the collections it's in ("Kansas City Chiefs", "NFL") and its tags
 * as "See more" links ("crown" → /search?tag=crown). Hidden when there's nothing to show.
 * Data: /api/public/designs/[id]/collections.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Data { collections: { name: string; shortName: string | null; path: string; kind: string }[]; tags: string[] }

export function useDesignCollections(imageId: string) {
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/public/designs/${imageId}/collections`).then(r => (r.ok ? r.json() : null)).then(d => !cancelled && setData(d)).catch(() => {});
    return () => { cancelled = true; };
  }, [imageId]);
  return data;
}

export default function DesignChips({ data }: { data: Data | null }) {
  if (!data || (!data.collections.length && !data.tags.length)) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2" aria-label="More like this">
      {data.collections.slice(0, 3).map(c => (
        <Link key={c.path} href={`/collections/${c.path}`} className="inline-flex h-8 items-center rounded-full bg-purple-100 px-3 text-sm font-medium text-purple-900 hover:bg-purple-200">
          {c.name}
        </Link>
      ))}
      {data.tags.slice(0, 5).map(t => (
        <Link key={t} href={`/search?tag=${encodeURIComponent(t)}`} className="inline-flex h-8 items-center rounded-full border border-gray-300 px-3 text-sm text-gray-800 hover:border-purple-400 hover:text-purple-800" aria-label={`See more ${t} designs`}>
          {t}
        </Link>
      ))}
    </div>
  );
}
