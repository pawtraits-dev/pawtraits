'use client';

/** A collection as a picture tile: its best design, name, how many designs, "In season" */
import Link from 'next/link';
import { CatalogImage } from '@/components/CloudinaryImageDisplay';

export interface CardCollection {
  path: string; name: string; shortName?: string | null; designs: number; heroImageId: string | null;
  inSeason?: boolean; details?: Record<string, any>;
}

export default function CollectionCard({ c, size = 'md' }: { c: CardCollection; size?: 'sm' | 'md' }) {
  const colours: { hex: string; name: string }[] = Array.isArray(c.details?.colours) ? c.details!.colours : [];
  return (
    <Link href={`/collections/${c.path}`} className="group block">
      <div className={`relative overflow-hidden rounded-xl bg-purple-50 [&>div]:h-full ${size === 'sm' ? 'aspect-square' : 'aspect-[4/5]'}`}>
        {c.heroImageId ? (
          <CatalogImage imageId={c.heroImageId} alt="" sizes="(min-width: 768px) 25vw, 50vw"
            className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl" aria-hidden>{c.details?.symbol ?? '🐾'}</div>
        )}
        {c.inSeason && <span className="absolute left-2 top-2 rounded-md bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-purple-800">In season</span>}
        {colours.length > 0 && (
          <span className="absolute bottom-2 left-2 flex overflow-hidden rounded-md border border-white/80 shadow-sm" aria-hidden>
            {colours.slice(0, 3).map(k => <span key={k.hex} className="h-3 w-4" style={{ background: k.hex }} />)}
          </span>
        )}
      </div>
      <p className="mt-2 text-sm font-semibold leading-snug text-gray-900 line-clamp-2">
        {c.details?.symbol ? <span aria-hidden>{c.details.symbol} </span> : null}{c.name}
      </p>
      <p className="text-xs text-gray-600">{c.designs} design{c.designs === 1 ? '' : 's'}</p>
    </Link>
  );
}
