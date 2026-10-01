'use client';

/**
 * "What's your pet's Pawsonality?" band for the home page (phase 5 way in). Shown only while
 * the quiz is live (GET /api/public/quiz/pawsonality/status), with a button per live species.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, X } from 'lucide-react';

const lifeSavers = { fontFamily: 'var(--font-life-savers), cursive' };

export default function QuizPromo({ source = 'home' }: { source?: string }) {
  const [live, setLive] = useState<{ dog: boolean; cat: boolean } | null>(null);

  useEffect(() => {
    fetch('/api/public/quiz/pawsonality/status')
      .then(r => (r.ok ? r.json() : null))
      .then(d => setLive(d ? { dog: !!d.dog, cat: !!d.cat } : null))
      .catch(() => setLive(null));
  }, []);

  if (!live || (!live.dog && !live.cat)) return null;
  const href = (animal: 'dog' | 'cat') => `/quiz/pawsonality?animal=${animal}&src=${source}`;

  return (
    <section className="mx-auto max-w-6xl px-5 pt-10" aria-labelledby="pawsonality-promo">
      <div className="grid items-center gap-6 overflow-hidden rounded-2xl bg-[#2A1A52] px-5 py-7 text-white md:grid-cols-[1fr_auto] md:px-10">
        <div>
          <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-[#D9CDF5]">
            Free quiz · about 90 seconds
          </span>
          <h2 id="pawsonality-promo" className="mt-3 text-[1.9rem] leading-[1.1] md:text-4xl" style={lifeSavers}>
            What&rsquo;s your pet&rsquo;s Pawsonality?
          </h2>
          <p className="mt-2 max-w-md text-[#D9CDF5]">
            20 quick swipes, 16 types, and a Pawtrait of the result painted as your pet&rsquo;s breed. Suspiciously accurate.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            {live.dog && (
              <Link href={href('dog')} className="flex h-12 items-center justify-center rounded-xl bg-white px-6 font-bold text-[#2A1A52] hover:bg-purple-50">
                Start with my dog
              </Link>
            )}
            {live.cat && (
              <Link href={href('cat')}
                className={`flex h-12 items-center justify-center rounded-xl px-6 font-bold ${live.dog ? 'border-2 border-white/40 text-white hover:border-white' : 'bg-white text-[#2A1A52] hover:bg-purple-50'}`}>
                Start with my cat
              </Link>
            )}
          </div>
        </div>

        {/* A quiz card at a glance (decorative) */}
        <div aria-hidden="true" className="relative mx-auto hidden h-[210px] w-[230px] sm:block">
          <div className="absolute inset-x-5 top-3 bottom-0 rotate-[5deg] rounded-2xl bg-white/15" />
          <div className="absolute inset-0 -rotate-[3deg] rounded-2xl bg-white p-5 text-gray-900 shadow-xl">
            <p className="text-xs font-bold uppercase tracking-wider text-purple-700">7 of 20</p>
            <p className="mt-3 text-xl font-bold leading-snug">Biscuit ALWAYS… <span className="font-normal">greets the post like it&rsquo;s a long-lost friend</span></p>
            <div className="absolute inset-x-5 bottom-5 flex justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-300"><X className="h-5 w-5" /></span>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-700 text-white"><Check className="h-5 w-5" /></span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
