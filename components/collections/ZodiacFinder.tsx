'use client';

/** "Find your pet's sign": a birthday → their zodiac sign, with a link to its designs */
import { useState } from 'react';
import Link from 'next/link';
import { zodiacFor } from '@/lib/collections/definitions';

export default function ZodiacFinder({ available }: { available: Set<string> }) {
  const [date, setDate] = useState('');
  const sign = date ? zodiacFor(new Date(`${date}T12:00:00`)) : null;
  return (
    <section className="rounded-2xl border border-purple-200 bg-purple-50 p-4">
      <h2 className="text-lg font-bold text-gray-900">Find your pet’s sign</h2>
      <label className="mt-2 block text-sm text-gray-700">Their birthday (or gotcha day)
        <input type="date" value={date} onChange={e => setDate(e.target.value)} max={new Date().toISOString().slice(0, 10)}
          className="mt-1 block h-11 w-full max-w-xs rounded-lg border border-gray-300 bg-white px-3 text-base" />
      </label>
      {sign && (
        <p className="mt-3 text-gray-900" role="status">
          <span className="text-2xl" aria-hidden>{sign.symbol}</span> They’re a <strong>{sign.name}</strong>.{' '}
          {available.has(sign.slug)
            ? <Link href={`/collections/zodiac/${sign.slug}`} className="font-semibold text-purple-700 underline">See {sign.name} designs</Link>
            : <span className="text-gray-600">{sign.name} designs are on the easel. Any design can still be painted with your pet.</span>}
        </p>
      )}
    </section>
  );
}
