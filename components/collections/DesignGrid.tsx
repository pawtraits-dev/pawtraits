'use client';

/** Grid of design tiles for collection and search pages (2 columns on phones, 4 on desktop) */
import Link from 'next/link';
import { CatalogImage } from '@/components/CloudinaryImageDisplay';
import { designTitle } from '@/lib/text/plain';

export interface GridDesign { id: string; description?: string | null; publicUrl?: string | null; breed?: { name: string } | null; pets?: number | null }

export default function DesignGrid({ designs, from }: { designs: GridDesign[]; from?: string }) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-4">
      {designs.map(d => {
        const title = designTitle(d.description);
        return (
          <li key={d.id}>
            <Link href={`/customise/${d.id}${from ? `?from=${encodeURIComponent(from)}` : ''}`} className="group block">
              <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-gray-100 [&>div]:h-full">
                <CatalogImage imageId={d.id} alt={title} fallbackUrl={d.publicUrl || undefined}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                {(d.pets ?? 1) > 1 && <PetsBadge n={d.pets!} />}
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

/** "2 pets" on a design card */
export function PetsBadge({ n }: { n: number }) {
  return <span className="absolute left-2 top-2 rounded-md bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-purple-800 shadow-sm">{n} pets</span>;
}

/** Any · 1 pet · 2+ pets */
export function PetCountFilter({ value, onChange }: { value: 1 | 2 | null; onChange: (v: 1 | 2 | null) => void }) {
  return (
    <div className="flex gap-1.5" role="group" aria-label="Number of pets">
      {([[null, 'Any number'], [1, '1 pet'], [2, '2+ pets']] as [1 | 2 | null, string][]).map(([v, label]) => (
        <button key={label} onClick={() => onChange(v)} aria-pressed={value === v}
          className={`h-9 rounded-full px-4 text-sm font-semibold ${value === v ? 'bg-gray-900 text-white' : 'border border-gray-300 bg-white text-gray-800 hover:border-gray-500'}`}>{label}</button>
      ))}
    </div>
  );
}

export function GridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-4" aria-hidden>
      {Array.from({ length: count }).map((_, i) => <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-gray-100" />)}
    </div>
  );
}
