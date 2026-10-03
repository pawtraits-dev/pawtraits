'use client';

/**
 * "More like this" on the design page: same breed first, then the design's (most specific)
 * collection, then designs sharing its first tag.
 * Data: /api/images (by breed), /api/public/collection, /api/public/search?tag=.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CatalogImage } from '@/components/CloudinaryImageDisplay';
import { designTitle } from '@/lib/text/plain';

interface Item { id: string; description?: string; public_url?: string; image_url?: string }

export default function MoreLikeThis({ imageId, breedId, collection, tag, max = 4 }: {
  imageId: string; breedId?: string | null; collection?: { path: string; name: string } | null; tag?: string | null; max?: number;
}) {
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const seen = new Set<string>([imageId]);
      const out: Item[] = [];
      const sources: (() => Promise<Item[]>)[] = [];
      const get = async (url: string) => { const r = await fetch(url); return r.ok ? r.json() : null; };
      if (breedId) sources.push(async () => ((await get(`/api/images?public=true&limit=12&breed_id=${breedId}`))?.images || []) as Item[]);
      if (collection) sources.push(async () => ((await get(`/api/public/collection?path=${encodeURIComponent(collection.path)}`))?.designs || [])
        .map((d: any) => ({ id: d.id, description: d.description, public_url: d.publicUrl })));
      if (tag) sources.push(async () => ((await get(`/api/public/search?tag=${encodeURIComponent(tag)}`))?.designs || []) as Item[]);
      for (const load of sources) {
        if (out.length >= max) break;
        try {
          for (const img of await load()) {
            if (out.length >= max) break;
            if (!seen.has(img.id)) { seen.add(img.id); out.push(img); }
          }
        } catch { /* optional section */ }
      }
      if (!cancelled) setItems(out);
    })();
    return () => { cancelled = true; };
  }, [imageId, breedId, collection?.path, tag, max]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!items || items.length === 0) return null;

  return (
    <section aria-labelledby="more-heading" className="mt-8">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 id="more-heading" className="text-lg font-bold text-gray-900">More like this</h2>
        <Link href={collection ? `/collections/${collection.path}` : '/browse'} className="text-sm font-semibold text-purple-700">{collection ? `More ${collection.name}` : 'See all'}</Link>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-5">
        {items.map(img => (
          <Link key={img.id} href={`/customise/${img.id}`} className="group block">
            <div className="aspect-[2/3] overflow-hidden rounded-xl bg-gray-100 [&>div]:h-full">
              <CatalogImage imageId={img.id} alt={designTitle(img.description)} fallbackUrl={img.image_url || img.public_url}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
            </div>
            <p className="mt-2 text-sm font-semibold leading-snug text-gray-900 line-clamp-2">{designTitle(img.description)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
