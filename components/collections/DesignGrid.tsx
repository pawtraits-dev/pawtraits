'use client';

/** Grid of design tiles for collection and search pages (2 columns on phones, 4 on desktop) */
import Link from 'next/link';
import { CatalogImage } from '@/components/CloudinaryImageDisplay';
import { designTitle } from '@/lib/text/plain';

export interface GridDesign { id: string; description?: string | null; publicUrl?: string | null; breed?: { name: string } | null }

export default function DesignGrid({ designs, from }: { designs: GridDesign[]; from?: string }) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-4">
      {designs.map(d => {
        const title = designTitle(d.description);
        return (
          <li key={d.id}>
            <Link href={`/customise/${d.id}${from ? `?from=${encodeURIComponent(from)}` : ''}`} className="group block">
              <div className="aspect-[2/3] overflow-hidden rounded-xl bg-gray-100 [&>div]:h-full">
                <CatalogImage imageId={d.id} alt={title} fallbackUrl={d.publicUrl || undefined}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
              </div>
              <p className="mt-2 text-sm font-semibold leading-snug text-gray-900 line-clamp-2">{title}</p>
              {d.breed?.name && <p className="mt-0.5 text-xs text-gray-600 line-clamp-1">{d.breed.name}</p>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function GridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-4" aria-hidden>
      {Array.from({ length: count }).map((_, i) => <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-gray-100" />)}
    </div>
  );
}
