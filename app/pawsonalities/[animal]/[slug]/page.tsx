/**
 * /pawsonalities/[animal]/[slug] — one Pawsonality type: about, traits, all its pictures and the
 * breed versions, best buddies and the rest of its family. /pawsonalities/dog/enfb redirects to
 * the named URL. ?breed=<breed id> shows that breed's version first.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { Suspense } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import UserAwareNavigation from '@/components/UserAwareNavigation';
import BreedPicker from '@/components/pawsonalities/BreedPicker';
import { breedVersions, FAMILIES, getPawsonalities, pictureUrl, speciesBreeds, typeHref, type PawsonalityType } from '@/lib/quiz/pawsonalities';
import { poleLabel } from '@/lib/quiz/admin';
import { withPetName } from '@/lib/quiz/scoring';
import type { AnimalType, Pole } from '@/lib/quiz/types';

export const dynamic = 'force-dynamic';

const lifeSavers = { fontFamily: 'var(--font-life-savers), cursive' };
type Props = { params: Promise<{ animal: string; slug: string }>; searchParams: Promise<{ breed?: string }> };

async function load(animalParam: string, slug: string) {
  if (animalParam !== 'dog' && animalParam !== 'cat') return null;
  const animal = animalParam as AnimalType;
  const types = await getPawsonalities(animal);
  if (!types) return null;
  const type = types.find(t => t.slug === slug) ?? null;
  const byCode = /^[eisntfbc]{4}$/i.test(slug) ? types.find(t => t.code === slug.toUpperCase()) ?? null : null;
  return { animal, types, type, byCode };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { animal, slug } = await params;
  const d = await load(animal, slug).catch(() => null);
  const t = d?.type;
  if (!t) return { title: 'Pawsonalities | Pawtraits' };
  const pet = d!.animal === 'cat' ? 'Cat' : 'Dog';
  const description = [t.tagline, t.about?.split('. ').slice(0, 2).join('. ')].filter(Boolean).join(' · ').slice(0, 300);
  const image = t.mainImageId ? pictureUrl(t.mainImageId, 1200) : undefined;
  return {
    title: `${t.name} (${t.code}) · ${pet} Pawsonality | Pawtraits`,
    description,
    alternates: { canonical: typeHref(d!.animal, t) },
    openGraph: { title: `${t.name}: the ${t.code} ${pet.toLowerCase()}`, description, siteName: 'Pawtraits', locale: 'en_GB', type: 'article', ...(image ? { images: [{ url: image }] } : {}) },
  };
}

export default async function PawsonalityTypePage({ params, searchParams }: Props) {
  const { animal: animalParam, slug } = await params;
  const sp = await searchParams;
  const d = await load(animalParam, slug);
  if (!d) notFound();
  if (!d.type && d.byCode) permanentRedirect(typeHref(d.animal, d.byCode));
  const { animal, types } = d;
  const t = d.type;
  if (!t) notFound();

  const pet = animal === 'cat' ? 'cat' : 'dog';
  const breedId = sp.breed && /^[0-9a-f-]{36}$/i.test(sp.breed) ? sp.breed : null;
  const [breeds, versionsMap] = await Promise.all([speciesBreeds(animal), breedVersions(t.mainImageId ? [t.mainImageId] : [])]);
  const versions = t.mainImageId ? versionsMap.get(t.mainImageId) ?? [] : [];
  const rank = new Map(breeds.map((b, i) => [b.id, i]));
  const breedName = new Map(breeds.map(b => [b.id, b.name]));
  versions.sort((a, b) => (rank.get(a.breedId) ?? 9999) - (rank.get(b.breedId) ?? 9999));
  const pickable = breeds.filter(b => versions.some(v => v.breedId === b.id));
  const chosen = breedId ? versions.find(v => v.breedId === breedId) ?? null : null;
  const heroImage = chosen?.imageId ?? t.mainImageId;
  const shownVersions = breedId ? versions.filter(v => v.breedId === breedId) : versions.slice(0, 12);

  const family = FAMILIES.find(f => t.code.startsWith(f.prefix));
  const siblings = types.filter(x => x.code !== t.code && family && x.code.startsWith(family.prefix));
  const buddies = (t.bestBuddies ?? []).map(c => types.find(x => x.code === c)).filter(Boolean) as PawsonalityType[];
  const i = types.findIndex(x => x.code === t.code);
  const prev = types[(i - 1 + types.length) % types.length];
  const next = types[(i + 1) % types.length];
  const quote = t.shareQuote ? withPetName(t.shareQuote, `My ${pet}`) : null;
  const paintHref = heroImage ? `/customise/${heroImage}?start=photo&src=pawsonalities` : null;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <UserAwareNavigation />

      <div className="mx-auto max-w-5xl px-5 pt-5">
        <Link href={animal === 'cat' ? '/pawsonalities?animal=cat' : '/pawsonalities'} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-purple-800">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All {pet} Pawsonalities
        </Link>
      </div>

      <section className="mx-auto grid max-w-5xl gap-8 px-5 pb-8 pt-4 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div>
          <div className="aspect-[2/3] overflow-hidden rounded-2xl bg-[#F6F2FC]">
            {heroImage
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={pictureUrl(heroImage, 800)} srcSet={`${pictureUrl(heroImage, 600)} 600w, ${pictureUrl(heroImage, 800)} 800w, ${pictureUrl(heroImage, 1200)} 1200w`}
                  sizes="(min-width: 768px) 440px, 100vw" alt={`${t.name}${chosen ? ` as a ${breedName.get(chosen.breedId)}` : ''}`} className="h-full w-full object-cover" />
              : <div className="flex h-full items-center justify-center text-purple-300">Being painted</div>}
          </div>
          {chosen && <p className="mt-2 text-center text-sm text-gray-600">Painted as a {breedName.get(chosen.breedId)}</p>}
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-7 items-center rounded-md bg-gray-900 px-2.5 text-sm font-bold tracking-[0.08em] text-white">{t.code}</span>
            {family && <span className="text-sm text-gray-600">{family.name}</span>}
          </div>
          <h1 className="mt-3 text-[2.5rem] leading-[1.05] sm:text-5xl" style={lifeSavers}>{t.name}</h1>
          {t.tagline && <p className="mt-1 text-xl font-semibold text-purple-800">{t.tagline}</p>}

          <ul className="mt-4 flex flex-wrap gap-2" aria-label="The four letters">
            {t.code.split('').map(p => (
              <li key={p} className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-[#F6F2FC] py-1 pl-1 pr-3 text-sm">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-700 text-xs font-bold text-white">{p}</span>
                {poleLabel(p as Pole, animal)}
              </li>
            ))}
          </ul>

          {t.about && <p className="mt-5 text-lg leading-relaxed text-gray-800">{t.about}</p>}
          {!t.about && t.ownerReality && <p className="mt-5 text-lg leading-relaxed text-gray-800">{t.ownerReality}</p>}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={`/quiz/pawsonality?animal=${animal}&src=pawsonality-type`} className="inline-flex h-12 items-center rounded-xl bg-purple-700 px-5 text-base font-bold text-white hover:bg-purple-800">
              Is this your {pet}? Take the quiz
            </Link>
            {paintHref && (
              <Link href={paintHref} className="inline-flex h-12 items-center rounded-xl border-[1.5px] border-purple-200 bg-white px-5 text-base font-bold text-purple-800 hover:bg-purple-50">
                Paint your {pet} as {t.name.replace(/^The /, 'the ')}
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="bg-[#F6F2FC] px-5 py-8" aria-labelledby="like">
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
          <div>
            <h2 id="like" className="text-xl font-bold">What they&apos;re like</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-gray-800">
              {(t.traits ?? []).map(x => <li key={x}>{x}</li>)}
              {t.signatureMove && <li><strong>Signature move:</strong> {t.signatureMove}</li>}
              {t.about && t.ownerReality && <li><strong>Owner reality:</strong> {t.ownerReality}</li>}
            </ul>
            {(t.famousExamples ?? []).length > 0 && (
              <div className="mt-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-purple-700">Famous examples</h3>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {t.famousExamples!.map(f => <li key={f} className="rounded-full bg-white px-3 py-1 text-sm text-gray-800">{f}</li>)}
                </ul>
              </div>
            )}
          </div>
          {quote && (
            <blockquote className="self-center rounded-2xl bg-white px-6 py-6 text-2xl leading-snug text-gray-900" style={lifeSavers}>
              &ldquo;{quote}&rdquo;
            </blockquote>
          )}
        </div>
      </section>

      {t.pictures.length > 0 && (
        <section className="mx-auto max-w-5xl px-5 py-8" aria-labelledby="pictures">
          <h2 id="pictures" className="text-xl font-bold">{t.name} pictures</h2>
          <p className="text-sm text-gray-600">Pick one and we&apos;ll paint your own {pet} into it.</p>
          <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {t.pictures.map(p => (
              <li key={p.id}>
                <Link href={`/customise/${p.id}?src=pawsonalities`} className="group block">
                  <div className="aspect-[2/3] overflow-hidden rounded-xl bg-[#F6F2FC]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={pictureUrl(p.id, 400)} alt={p.title ?? t.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                  </div>
                  {p.style && <span className="mt-1.5 block text-sm text-gray-600">{p.style}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {versions.length > 0 && (
        <section className="mx-auto max-w-5xl px-5 pb-8" aria-labelledby="breeds">
          <div className="flex flex-wrap items-end justify-between gap-3 border-t border-gray-100 pt-6">
            <div>
              <h2 id="breeds" className="text-xl font-bold">Painted as your breed</h2>
              <p className="text-sm text-gray-600">{versions.length} breed{versions.length === 1 ? '' : 's'} so far{breedId ? '' : versions.length > 12 ? ', most popular first' : ''}.</p>
            </div>
            <Suspense><BreedPicker breeds={pickable} value={breedId} label="Breed" allLabel="Most popular" /></Suspense>
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {shownVersions.map(v => (
              <li key={v.imageId}>
                <Link href={`/customise/${v.imageId}?src=pawsonalities`} className="group block">
                  <div className="aspect-[2/3] overflow-hidden rounded-xl bg-[#F6F2FC]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={pictureUrl(v.imageId, 400)} alt={`${t.name} as a ${breedName.get(v.breedId) ?? pet}`} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                  </div>
                  <span className="mt-1.5 block text-sm font-medium text-gray-800">{breedName.get(v.breedId) ?? ''}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {buddies.length > 0 && (
        <section className="mx-auto max-w-5xl px-5 pb-8" aria-labelledby="buddies">
          <h2 id="buddies" className="border-t border-gray-100 pt-6 text-xl font-bold">Best buddies</h2>
          <p className="text-sm text-gray-600">Pawsonalities that get on famously with {t.name.replace(/^The /, 'the ')}.</p>
          <TypeRow animal={animal} list={buddies} />
        </section>
      )}

      {siblings.length > 0 && family && (
        <section className="mx-auto max-w-5xl px-5 pb-8" aria-labelledby="family">
          <h2 id="family" className="border-t border-gray-100 pt-6 text-xl font-bold">More {family.name} {pet}s</h2>
          <TypeRow animal={animal} list={siblings} />
        </section>
      )}

      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-3 border-t border-gray-100 px-5 py-6 text-sm" aria-label="Other types">
        <Link href={typeHref(animal, prev)} className="inline-flex items-center gap-1 text-gray-700 hover:text-purple-800"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> {prev.name}</Link>
        <Link href={typeHref(animal, next)} className="inline-flex items-center gap-1 text-right text-gray-700 hover:text-purple-800">{next.name} <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
      </nav>

      <section className="bg-[#F6F2FC] px-5 py-10 text-center">
        <h2 className="text-2xl" style={lifeSavers}>Is your {pet} {t.name.replace(/^The /, 'the ')}?</h2>
        <p className="mt-2 text-gray-700">20 quick swipes, free and no sign-up. The result comes painted as a Pawtrait.</p>
        <Link href={`/quiz/pawsonality?animal=${animal}&src=pawsonality-type`} className="mt-5 inline-flex h-12 items-center rounded-xl bg-purple-700 px-6 text-base font-bold text-white hover:bg-purple-800">
          Take the quiz
        </Link>
      </section>
    </div>
  );
}

function TypeRow({ animal, list }: { animal: AnimalType; list: PawsonalityType[] }) {
  return (
    <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {list.map(x => (
        <li key={x.code}>
          <Link href={typeHref(animal, x)} className="group flex gap-3 rounded-xl border border-gray-200 p-2 hover:border-purple-300">
            <div className="h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-[#F6F2FC]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {x.mainImageId && <img src={pictureUrl(x.mainImageId, 200)} alt="" loading="lazy" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0">
              <span className="inline-flex rounded bg-gray-900 px-1.5 py-0.5 text-[11px] font-bold tracking-wider text-white">{x.code}</span>
              <span className="mt-1 block text-sm font-semibold leading-tight text-gray-900 group-hover:text-purple-800">{x.name}</span>
              {x.tagline && <span className="block truncate text-xs text-gray-600">{x.tagline}</span>}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
