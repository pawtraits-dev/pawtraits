'use client';

/**
 * Collections shown as circles, matching "Find your breed": the collection's best design in a
 * 68px circle with a light purple ring, the name underneath, and a small note (In season, team
 * colours, or the number of designs). `CollectionCircles` lays them out as a sideways-scrolling
 * row (home, /collections) or a wrapping grid (all the teams in a league).
 */
import Link from 'next/link';
import { CatalogImage } from '@/components/CloudinaryImageDisplay';

export interface CardCollection {
  path: string; name: string; shortName?: string | null; designs: number; heroImageId: string | null;
  inSeason?: boolean; details?: Record<string, any>;
}

export default function CollectionCircle({ c, showCount = false }: { c: CardCollection; showCount?: boolean }) {
  const colours: { hex: string; name: string }[] = Array.isArray(c.details?.colours) ? c.details!.colours : [];
  const label = c.details?.symbol ? `${c.details.symbol} ${c.name}` : c.name;
  return (
    <Link href={`/collections/${c.path}`} className="group flex w-[76px] shrink-0 flex-col items-center gap-1.5 text-center text-xs font-medium text-gray-800">
      <span className={`block h-[68px] w-[68px] overflow-hidden rounded-full border-2 bg-purple-50 [&>div]:h-full ${c.inSeason ? 'border-purple-500' : 'border-purple-100'}`}>
        {c.heroImageId ? (
          <CatalogImage imageId={c.heroImageId} alt="" sizes="68px" className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <span className="flex h-full items-center justify-center text-2xl" aria-hidden>{c.details?.symbol ?? '🐾'}</span>
        )}
      </span>
      <span className="line-clamp-2 leading-tight">{label}</span>
      {c.inSeason ? (
        <span className="-mt-1 text-[10px] font-semibold uppercase tracking-wide text-purple-700">In season</span>
      ) : colours.length > 0 ? (
        <span className="-mt-0.5 flex overflow-hidden rounded-sm border border-gray-300" aria-hidden>
          {colours.slice(0, 3).map(k => <span key={k.hex} className="h-2 w-3" style={{ background: k.hex }} />)}
        </span>
      ) : showCount ? (
        <span className="-mt-1 text-[11px] font-normal text-gray-500">{c.designs} design{c.designs === 1 ? '' : 's'}</span>
      ) : null}
    </Link>
  );
}

export function CollectionCircles({ items, layout = 'scroll', showCount = false, label }: {
  items: (CardCollection & { id?: string })[]; layout?: 'scroll' | 'wrap'; showCount?: boolean; label?: string;
}) {
  return (
    <ul aria-label={label}
      className={layout === 'scroll'
        ? '-mx-5 flex gap-4 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
        : 'flex flex-wrap gap-x-4 gap-y-4'}>
      {items.map(c => <li key={c.id ?? c.path}><CollectionCircle c={c} showCount={showCount} /></li>)}
    </ul>
  );
}
