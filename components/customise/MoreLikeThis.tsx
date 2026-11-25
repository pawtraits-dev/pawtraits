'use client';

/**
 * "More like this" on the design page: other versions of the same design, then the same breed,
 * then (only if still short) the design's most specific collection and designs sharing its first tag.
 * Data: /api/public/designs/[id]/related, /api/public/collection, /api/public/search?tag=.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CatalogImage } from '@/components/CloudinaryImageDisplay';
import { designTitle } from '@/lib/text/plain';
import { PetsBadge } from '@/components/collections/DesignGrid';
import { collectionHref } from '@/lib/collections/href';
import { mergeMoreLikeThis, needsFallback } from '@/lib/catalog/more-like-this';
import { breedBrowseHref } from '@/lib/catalog/browse-params';

interface Item { id: string; description?: string; public_url?: string; image_url?: string; subject_count?: number }

export default function MoreLikeThis({ imageId, breedId, breedName, animalType, collection, tag, max = 4 }: {
  imageId: string; breedId?: string | null; breedName?: string | null; animalType?: string | null; collection?: { path: string; name: string } | null; tag?: string | null; max?: number;
}) {
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const get = async (url: string) => { const r = await fetch(url); return r.ok ? r.json() : null; };
      const lists: Item[][] = [];
      const count = () => mergeMoreLikeThis(lists, imageId, max).length;
      // 1 and 2: other versions of this design, then the same breed (one server lookup)
      try {
        const rel = await get(`/api/public/designs/${imageId}/related`);
        lists.push((rel?.versions || []) as Item[], (rel?.breed || []) as Item[]);
      } catch { /* optional section */ }
      // 3: only if still short, the collection, then the first tag
      if (needsFallback(count(), max) && collection) {
        try {
          lists.push(((await get(`/api/public/collection?path=${encodeURIComponent(collection.path)}`))?.designs || [])
            .map((d: any) => ({ id: d.id, description: d.description, public_url: d.publicUrl, subject_count: d.pets })));
        } catch { /* optional section */ }
      }
      if (needsFallback(count(), max) && tag) {
        try { lists.push(((await get(`/api/public/search?tag=${encodeURIComponent(tag)}`))?.designs || []) as Item[]); } catch { /* optional section */ }
      }
      const out = mergeMoreLikeThis(lists, imageId, max);
      if (!cancelled) setItems(out);
    })();
    return () => { cancelled = true; };
  }, [imageId, breedId, collection?.path, tag, max]); // eslint-disable-line react-hooks/exhaustive-deps

  // One click to every design of this breed, else the collection, else everything
  const seeAll = breedId && breedName
    ? { href: breedBrowseHref(breedId, animalType), label: `All ${breedName} designs` }
    : collection ? { href: collectionHref(collection.path), label: `More ${collection.name}` } : { href: '/browse', label: 'See all' };
  const seeAllLink = <Link href={seeAll.href} className="text-sm font-semibold text-purple-700">{seeAll.label}</Link>;

  if (!items || items.length === 0) return breedId && breedName ? <p className="mt-8 text-center">{seeAllLink}</p> : null;

  return (
    <section aria-labelledby="more-heading" className="mt-8">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 id="more-heading" className="text-lg font-bold text-gray-900">More like this</h2>
        {seeAllLink}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-5">
        {items.map(img => (
          <Link key={img.id} href={`/customise/${img.id}`} className="group block">
            <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-gray-100 [&>div]:h-full">
              <CatalogImage imageId={img.id} alt={designTitle(img.description)} fallbackUrl={img.image_url || img.public_url} version={img.public_url || img.image_url}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
              {(img.subject_count ?? 1) > 1 && <PetsBadge n={img.subject_count!} />}
            </div>
            <p className="mt-2 text-sm font-semibold leading-snug text-gray-900 line-clamp-2">{designTitle(img.description)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
