'use client';

/** Grid of design tiles for collection and search pages (2 columns on phones, 4 on desktop) */
import Link from 'next/link';
import { CatalogImage } from '@/components/CloudinaryImageDisplay';
import { designTitle } from '@/lib/text/plain';

export interface GridDesign {
  id: string; description?: string | null; publicUrl?: string | null; breed?: { name: string } | null; pets?: number | null;
  /** The zodiac sign or tarot card a design belongs to, on the whole-collection pages */
  group?: { path: string; label: string; mark: string } | null;
}

export default function DesignGrid({ designs, from }: { designs: GridDesign[]; from?: string }) {
  // Sign by sign (card by card) when the designs say which one they are
  if (designs.some(d => d.group)) {
    const runs: { group: GridDesign['group']; items: GridDesign[] }[] = [];
    for (const d of designs) {
      const last = runs[runs.length - 1];
      if (last && (last.group?.path ?? '') === (d.group?.path ?? '')) last.items.push(d);
      else runs.push({ group: d.group ?? null, items: [d] });
    }
    return (
      <div className="space-y-8">
        {runs.map((r, i) => (
          <section key={`${r.group?.path ?? 'other'}-${i}`} aria-label={r.group?.label}>
            {r.group && (
              <h2 className="mb-3 flex items-baseline gap-2 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">
                <span aria-hidden className="min-w-6 text-center text-purple-800">{r.group.mark}</span>
                <Link href={`/collections/${r.group.path}`} className="hover:underline">{r.group.label}</Link>
              </h2>
            )}
            <Cards designs={r.items} from={from} />
          </section>
        ))}
      </div>
    );
  }
  return <Cards designs={designs} from={from} />;
}

function Cards({ designs, from }: { designs: GridDesign[]; from?: string }) {
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
              {d.group && <p className="mt-0.5 text-xs font-semibold text-purple-800"><span aria-hidden>{d.group.mark}</span> {d.group.label}</p>}
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
