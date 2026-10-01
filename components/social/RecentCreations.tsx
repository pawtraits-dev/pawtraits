'use client';

/**
 * Home page "Recent custom creations around the world" (spec docs/specs/social-loop.md, phase 2).
 * Latest paid customised Pawtraits as before/after reveals, with the pet's first name and the
 * buyer's town and country. Phones: one at a time; desktop: three. Arrows page through; there is
 * no swipe-to-scroll so dragging the divider never fights the carousel. Hidden when empty or off.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import BeforeAfter from './BeforeAfter';

interface Item { id: string; kind?: 'purchase' | 'preview'; petName: string | null; place: string | null; beforeUrl: string; afterUrl: string; paidAt: string }

const lifeSavers = { fontFamily: 'var(--font-life-savers), cursive' };

function ago(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return mins < 5 ? 'just now' : `${mins} minutes ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours === 1 ? 'an hour ago' : `${hours} hours ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : days < 14 ? `${days} days ago` : 'recently';
}

function caption(i: Item) {
  const who = i.petName ? <>A custom portrait of <strong>{i.petName}</strong></> : <>A custom portrait</>;
  const verb = i.kind === 'preview' ? 'was created' : 'was ordered';
  return <>{who} {verb} {ago(i.paidAt)}{i.place ? <> by a pet parent in <strong>{i.place}</strong></> : null}</>;
}

export default function RecentCreations() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [start, setStart] = useState(0);
  const [perPage, setPerPage] = useState(1);

  useEffect(() => {
    fetch('/api/public/social/feed').then(r => (r.ok ? r.json() : { items: [] }))
      .then(d => setItems(Array.isArray(d.items) ? d.items : [])).catch(() => setItems([]));
    const mq = window.matchMedia('(min-width: 768px)');
    const set = () => setPerPage(mq.matches ? 3 : 1);
    set(); mq.addEventListener('change', set);
    return () => mq.removeEventListener('change', set);
  }, []);

  if (!items || items.length === 0) return null;
  const pages = Math.max(1, items.length - perPage + 1);
  const first = Math.min(start, pages - 1);
  const shown = items.slice(first, first + perPage);

  return (
    <section className="mx-auto max-w-6xl px-5 pt-10" aria-labelledby="recent-creations">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="recent-creations" className="text-[1.6rem] leading-tight md:text-3xl" style={lifeSavers}>Recent custom creations around the world</h2>
          <p className="mt-1 text-sm text-gray-600">Real pets, painted by Pawcasso. Drag across a picture to see the photo they started with.</p>
        </div>
        {items.length > perPage && (
          <div className="flex shrink-0 gap-2">
            <button type="button" aria-label="Previous" onClick={() => setStart(s => Math.max(0, Math.min(s, pages - 1) - 1))} disabled={first === 0}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-300 bg-white disabled:opacity-40"><ChevronLeft className="h-5 w-5" /></button>
            <button type="button" aria-label="Next" onClick={() => setStart(s => Math.min(pages - 1, s + 1))} disabled={first >= pages - 1}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-300 bg-white disabled:opacity-40"><ChevronRight className="h-5 w-5" /></button>
          </div>
        )}
      </div>

      <ul className="mt-4 grid gap-5 md:grid-cols-3" aria-live="polite">
        {shown.map(i => (
          <li key={i.id}>
            <BeforeAfter before={i.beforeUrl} after={i.afterUrl} label={i.petName ?? 'a customer’s pet'} />
            <p className="mt-2.5 flex gap-1.5 text-sm leading-snug text-gray-800">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-purple-700" aria-hidden="true" />
              <span>{caption(i)}</span>
            </p>
          </li>
        ))}
      </ul>
      {items.length > perPage && <p className="mt-2 text-center text-xs text-gray-500 md:hidden">{first + 1} of {items.length}</p>}
      <Link href="/browse" className="mt-4 inline-flex text-sm font-semibold text-purple-700">Make your pet&rsquo;s Pawtrait &rarr;</Link>
    </section>
  );
}
