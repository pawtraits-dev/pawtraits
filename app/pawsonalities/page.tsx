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
import { breedVersions, collectionDesigns, dimensionGuide, FAMILIES, getPawsonalities, pictureUrl, speciesBreeds, typeHref } from '@/lib/quiz/pawsonalities';
import type { AnimalType } from '@/lib/quiz/types';

export const dynamic = 'force-dynamic';

const lifeSavers = { fontFamily: 'var(--font-life-savers), cursive' };
type Props = { searchParams: Promise<{ animal?: string; breed?: string }> };

export const metadata: Metadata = {
  title: 'The 16 Pawsonalities | Pawtraits',
  description: 'Four dimensions, two ends each, 16 Pawsonalities for dogs and cats, from The Golden Retriever to The Window Philosopher. Which one is your pet? Take the free 90-second quiz.',
  alternates: { canonical: '/pawsonalities' },
  openGraph: { title: 'The 16 Pawsonalities', description: 'Which one is your pet? Meet all 16 types, then take the free quiz.', siteName: 'Pawtraits', locale: 'en_GB', type: 'website' },
};

export default async function PawsonalitiesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const animal: AnimalType = sp.animal === 'cat' ? 'cat' : 'dog';
  const breedId = sp.breed && /^[0-9a-f-]{36}$/i.test(sp.breed) ? sp.breed : null;
  const [types, breeds] = await Promise.all([getPawsonalities(animal), speciesBreeds(animal)]);
  // Types with no linked design yet borrow a design from their collection, for this species only
  // (the collections are shared by dogs and cats, so their cover picture may be a dog)
  const collectionHero = new Map<string, string>();
  await Promise.all((types ?? []).filter(t => !t.mainImageId).map(async t => {
    const first = (await collectionDesigns(t.code, animal, 1).catch(() => []))[0];
    if (first) collectionHero.set(t.code, first.id);
  }));

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
  const guide = dimensionGuide(animal);
  // Worked example: the first end of each dimension (ESTB)
  const example = { code: guide.map(d => d.poles[0].letter).join(''), names: guide.map(d => d.poles[0].name).join(', ').replace(/, ([^,]*)$/, ' and $1') };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <UserAwareNavigation />

      <section className="bg-[#F6F2FC] px-5 pb-10 pt-8">
        <div className="mx-auto max-w-5xl text-center">
          <p className="inline-flex rounded-full border border-purple-200 bg-white px-3 py-1 text-sm font-semibold text-purple-800">16 Pawsonalities · for dogs and cats</p>
          <h1 className="mt-4 text-[2.5rem] leading-[1.05] sm:text-6xl" style={lifeSavers}>Meet the 16 Pawsonalities</h1>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-gray-700">
            Every {pet} has a personality, and most have opinions too. Four dimensions, two ends to each, sixteen possible combinations: one of them is unmistakably your {pet}. Browse them below, or let the 90-second quiz work it out.
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

      <section className="mx-auto max-w-5xl px-5 py-8" aria-labelledby="dimensions">
        <h2 id="dimensions" className="text-xl font-bold">The four dimensions</h2>
        <p className="mt-1 max-w-3xl text-gray-700">
          Each dimension has two ends, and each end has its own letter. A Pawsonality takes one letter from each dimension, so <strong>{example.code}</strong> means {example.names}. Two ends across four dimensions makes sixteen Pawsonalities.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {guide.map(d => (
            <div key={d.title} className="rounded-xl border border-gray-200 p-4">
              <p className="text-sm font-semibold uppercase tracking-wide text-purple-700">{d.title}</p>
              <p className="mt-0.5 text-sm font-medium text-gray-900">{d.question}</p>
              <ul className="mt-3 space-y-2">
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
            <div>
              <h2 className="text-xl font-bold">The 16 {pet} Pawsonalities</h2>
              <p className="text-sm text-gray-600">In four families, by their first two letters: how much energy they have, and how much company they want.</p>
            </div>
            <Suspense><BreedPicker breeds={pickable} value={breedId} /></Suspense>
          </div>
          {breedName && <p className="mt-2 text-sm text-gray-600">Showing each Pawsonality painted as a {breedName}, wherever we&apos;ve painted one so far.</p>}

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
        <h2 className="text-2xl" style={lifeSavers}>Still not sure which one is your {pet}?</h2>
        <p className="mt-2 text-gray-700">Twenty quick swipes, about 90 seconds, free and no sign-up. Their result comes painted as a Pawtrait you can keep.</p>
        <Link href={`/quiz/pawsonality?animal=${animal}&src=pawsonalities`} className="mt-5 inline-flex h-12 items-center rounded-xl bg-purple-700 px-6 text-base font-bold text-white hover:bg-purple-800">
          Find my {pet}&apos;s Pawsonality
        </Link>
      </section>
    </div>
  );
}
