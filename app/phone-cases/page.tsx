'use client';

/**
 * Phone cases (shop): designs whose case art is approved (Admin → Phone Cases → Case art), shown
 * on a phone → /phone-cases/design/[id] to choose the phone and paint your own pet into it.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import UserAwareNavigation from '@/components/UserAwareNavigation';
import { CountryProvider } from '@/lib/country-context';
import CasePreview from '@/components/phone-cases/CasePreview';
import type { PublicCaseDesign, PublicPhoneModel } from '@/lib/phone-cases/public';
import type { PhoneLayoutGroup } from '@/lib/phone-cases/geometry';

const lifeSavers = { fontFamily: 'var(--font-life-savers), cursive' };
const SHOWCASE = ['iphone-16pro', 'iphone-15', 'galaxy-s23'];

export default function PhoneCasesPage() {
  const [data, setData] = useState<{ designs: PublicCaseDesign[]; models: PublicPhoneModel[]; groups: PhoneLayoutGroup[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/public/phone-cases').then(r => (r.ok ? r.json() : Promise.reject(new Error('Could not load phone cases')))).then(setData).catch(e => setError(e.message));
  }, []);

  const showcase = (d: PublicCaseDesign) => {
    const m = SHOWCASE.map(id => data!.models.find(x => x.id === id)).find(x => x && d.art[x.group]) || data!.models.find(x => d.art[x.group]);
    const g = m && data!.groups.find(x => x.id === m.group);
    return m && g ? { m, g } : null;
  };
  const from = data?.models.find(m => m.product)?.product?.price_pence;

  return (
    <CountryProvider>
      <div className="min-h-[100dvh] bg-gray-50">
        <UserAwareNavigation />
        <main className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
          <h1 className="text-4xl sm:text-5xl text-gray-900" style={lifeSavers}>Pawtrait phone cases</h1>
          <p className="mt-3 max-w-2xl text-gray-700">
            Your pet painted into the picture, printed edge to edge on a slim, glossy case for your iPhone or Galaxy.
            Pick a design, choose your phone, add a photo and see it in about a minute{from ? ` · £${(from / 100).toFixed(2)}` : ''}.
          </p>
          {error && <p className="mt-8 text-red-700">{error}</p>}
          {!data && !error && <p className="mt-8 text-gray-500">Loading phone cases…</p>}
          {data && data.designs.length === 0 && <p className="mt-8 text-gray-600">Phone cases are coming soon.</p>}
          <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {data?.designs.map(d => {
              const s = showcase(d);
              if (!s) return null;
              return (
                <li key={d.id}>
                  <Link href={`/phone-cases/design/${d.id}`} className="group block rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200 hover:ring-purple-300">
                    <div className="flex justify-center transition-transform group-hover:scale-[1.02]">
                      <CasePreview url={d.art[s.m.group].url} layout={d.art[s.m.group].layout} model={s.m} camera={s.g.camera} className="h-64 w-auto sm:h-72" label={`${d.title} phone case`} />
                    </div>
                    <p className="mt-3 font-semibold text-gray-900">{d.title}</p>
                    <p className="text-sm text-gray-600">iPhone &amp; Galaxy</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </main>
      </div>
    </CountryProvider>
  );
}
