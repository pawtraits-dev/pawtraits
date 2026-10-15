/**
 * /pawsonalities — the 16 Pawsonality types (dogs or cats), grouped in four families, with a
 * breed picker that shows each type painted as that breed where a version exists.
 * ?animal=dog|cat  ?breed=<breed id>
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import UserAwareNavigation from '@/components/UserAwareNavigation';
import BreedPicker from '@/components/pawsonalities/BreedPicker';
import { breedVersions, dimensionGuide, FAMILIES, getPawsonalities, pictureUrl, speciesBreeds, typeHref } from '@/lib/quiz/pawsonalities';
import type { AnimalType } from '@/lib/quiz/types';
import { serviceClient } from '@/lib/qr/server';
import { loadPublicTree } from '@/lib/collections/public';

export const dynamic = 'force-dynamic';

const lifeSavers = { fontFamily: 'var(--font-life-savers), cursive' };
type Props = { searchParams: Promise<{ animal?: string; breed?: string }> };

export const metadata: Metadata = {
  title: 'The 16 Pawsonalities | Pawtraits',
  description: 'Meet the 16 Pawsonality types for dogs and cats: from The Golden Retriever to The Window Philosopher. Which one is your pet? Take the free 90-second quiz.',
  alternates: { canonical: '/pawsonalities' },
  openGraph: { title: 'The 16 Pawsonalities', description: 'Which one is your pet? Meet all 16 types, then take the free quiz.', siteName: 'Pawtraits', locale: 'en_GB', type: 'website' },
};

export default async function PawsonalitiesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const animal: AnimalType = sp.animal === 'cat' ? 'cat' : 'dog';
  const breedId = sp.breed && /^[0-9a-f-]{36}$/i.test(sp.breed) ? sp.breed : null;
  const [types, breeds, tree] = await Promise.all([getPawsonalities(animal), speciesBreeds(animal), loadPublicTree(serviceClient()).catch(() => [])]);
  // Types with no linked design yet borrow their collection's picture
  const collectionHero = new Map(tree.filter(c => c.path.startsWith('pawsonalities/')).map(c => [c.path.split('/')[1].toUpperCase(), c.heroImageId]));

  // Breeds that have at least one type painted as them; the chosen breed's versions
  const mains = (types ?? []).map(t => t.mainImageId).filter(Boolean) as string[];
  const [allVersions, chosen] = await Promise.all([breedVersions(mains), breedId ? breedVersions(mains, breedId) : Promise.resolve(new Map())]);
  const withVersions = new Set(Array.from(allVersions.values()).flat().map(v => v.breedId));
  const pickable = breeds.filter(b => withVersions.has(b.id));
  const breedName = breedId ? breeds.find(b => b.id === breedId)?.name : null;
  const qs = (extra: Record<string, string | null>) => {
    const p = new URLSearchParams();
    if (animal === 'cat') p.set('animal', 'cat');
    if (breedId) p.set('breed', breedId);
    for (const [k, v] of Object.entries(extra)) { if (v === null) p.delete(k); else p.set(k, v); }
    const s = p.toString();
    return s ? `?${s}` : '';
  };
  const pet = animal === 'cat' ? 'cat' : 'dog';

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <UserAwareNavigation />

      <section className="bg-[#F6F2FC] px-5 pb-10 pt-8">
        <div className="mx-auto max-w-5xl text-center">
          <p className="inline-flex rounded-full border border-purple-200 bg-white px-3 py-1 text-sm font-semibold text-purple-800">16 types · dogs &amp; cats</p>
          <h1 className="mt-4 text-[2.5rem] leading-[1.05] sm:text-6xl" style={lifeSavers}>Meet the 16 Pawsonalities</h1>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-gray-700">
            Four letters, sixteen personalities, one suspiciously accurate answer. Find your {pet} below, or let the quiz decide in about 90 seconds.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href={`/quiz/pawsonality?animal=${animal}&src=pawsonalities`} className="inline-flex h-12 items-center rounded-xl bg-purple-700 px-6 text-base font-bold text-white hover:bg-purple-800">
              Take the free quiz
            </Link>
            <div className="inline-flex rounded-xl border border-purple-200 bg-white p-1" role="tablist" aria-label="Dogs or cats">
              {(['dog', 'cat'] as AnimalType[]).map(a => (
                <Link key={a} href={a === 'cat' ? '/pawsonalities?animal=cat' : '/pawsonalities'} role="tab" aria-selected={animal === a}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold ${animal === a ? 'bg-purple-700 text-white' : 'text-gray-700 hover:bg-purple-50'}`}>
                  {a === 'dog' ? 'Dogs' : 'Cats'}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-8" aria-labelledby="letters">
        <h2 id="letters" className="text-xl font-bold">What the four letters mean</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {dimensionGuide(animal).map(d => (
            <div key={d.title} className="rounded-xl border border-gray-200 p-4">
              <p className="text-sm font-semibold uppercase tracking-wide text-purple-700">{d.title}</p>
              <ul className="mt-2 space-y-2">
                {d.poles.map(p => (
                  <li key={p.letter} className="flex gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-900 text-sm font-bold text-white">{p.letter}</span>
                    <span className="text-sm text-gray-700"><strong className="text-gray-900">{p.name}</strong>: {p.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {!types && (
        <p className="mx-auto max-w-5xl px-5 pb-12 text-gray-700">The {pet} Pawsonalities are being painted. Check back soon.</p>
      )}

      {types && (
        <section className="mx-auto max-w-5xl px-5 pb-12" aria-label="The 16 types">
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-6">
            <h2 className="text-xl font-bold">The 16 {pet} Pawsonalities</h2>
            <Suspense><BreedPicker breeds={pickable} value={breedId} /></Suspense>
          </div>
          {breedName && <p className="mt-2 text-sm text-gray-600">Showing each type painted as a {breedName} where we&apos;ve painted one.</p>}

          {FAMILIES.map(f => {
            const fam = types.filter(t => t.code.startsWith(f.prefix));
            if (!fam.length) return null;
            return (
              <div key={f.prefix} className="mt-8">
                <h3 className="text-lg font-bold text-gray-900">{f.name}</h3>
                <p className="text-sm text-gray-600">{f.blurb}</p>
                <ul className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-4">
                  {fam.map(t => {
                    const version = t.mainImageId ? chosen.get(t.mainImageId)?.[0]?.imageId : null;
                    const img = version ?? t.mainImageId ?? collectionHero.get(t.code) ?? null;
                    return (
                      <li key={t.code}>
                        <Link href={`${typeHref(animal, t)}${qs({ animal: null })}`} className="group block">
                          <div className="aspect-[2/3] overflow-hidden rounded-xl bg-[#F6F2FC]">
                            {img
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={pictureUrl(img, 400)} srcSet={`${pictureUrl(img, 300)} 300w, ${pictureUrl(img, 600)} 600w`} sizes="(min-width: 1024px) 240px, 45vw"
                                  alt={t.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                              : <div className="flex h-full items-center justify-center text-sm text-purple-300">Being painted</div>}
                          </div>
                          <span className="mt-2 inline-flex rounded bg-gray-900 px-1.5 py-0.5 text-xs font-bold tracking-wider text-white">{t.code}</span>
                          <span className="mt-1 block font-semibold text-gray-900 group-hover:text-purple-800">{t.name}</span>
                          {t.tagline && <span className="block text-sm text-gray-600">{t.tagline}</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </section>
      )}

      <section className="bg-[#F6F2FC] px-5 py-10 text-center">
        <h2 className="text-2xl" style={lifeSavers}>Not sure which one your {pet} is?</h2>
        <p className="mt-2 text-gray-700">20 quick swipes. Free, no sign-up, and the result comes painted as a Pawtrait.</p>
        <Link href={`/quiz/pawsonality?animal=${animal}&src=pawsonalities`} className="mt-5 inline-flex h-12 items-center rounded-xl bg-purple-700 px-6 text-base font-bold text-white hover:bg-purple-800">
          Find their Pawsonality
        </Link>
      </section>
    </div>
  );
}
