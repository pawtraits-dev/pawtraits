/**
 * Pawsonality result page (server). Phase 3: type, scores and copy from the version it was
 * scored on. Phase 4 adds the breed-matched Pawtrait, share card, matched designs and save.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import UserAwareNavigation from '@/components/UserAwareNavigation';
import { getPublicResult } from '@/lib/quiz/results';
import { withPetName } from '@/lib/quiz/scoring';
import { poleLabel } from '@/lib/quiz/admin';
import { DIMENSIONS } from '@/lib/quiz/types';

export const dynamic = 'force-dynamic';
const lifeSavers = { fontFamily: 'var(--font-life-savers), cursive' };

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const r = await getPublicResult(code).catch(() => null);
  if (!r) return { title: 'Pawsonality result | Pawtraits', robots: { index: false } };
  const title = `${r.petName} is ${r.type?.name ?? r.code}`;
  return {
    title: `${title} | Pawtraits`,
    description: `${r.code}${r.type?.tagline ? ` · ${r.type.tagline}` : ''}. What's your pet's Pawsonality? Take the free quiz.`,
    robots: { index: false, follow: true },
    openGraph: { title, description: "What's your pet's Pawsonality? Take the free 90-second quiz.", siteName: 'Pawtraits', locale: 'en_GB' },
  };
}

export default async function PawsonalityResultPage({ params }: Props) {
  const { code } = await params;
  const r = await getPublicResult(code);
  if (!r) notFound();
  const t = r.type;
  const name = r.petName;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <UserAwareNavigation />
      <main>
        <section className="bg-[#F6F2FC] px-5 pb-7 pt-6">
          <div className="mx-auto max-w-md">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 items-center rounded-md bg-gray-900 px-2.5 text-sm font-bold tracking-[0.08em] text-white">{r.code}</span>
              <span className="text-sm text-gray-700">{name}&rsquo;s Pawsonality</span>
            </div>
            <h1 className="mt-2 text-[2.25rem] leading-[1.08]" style={lifeSavers}>{name} is {t?.name ?? r.code}</h1>
            {t?.tagline && <p className="mt-1 text-lg font-semibold text-purple-800">{t.tagline}</p>}
            {t?.ownerReality && <p className="mt-1 text-gray-700">{t.ownerReality}</p>}
          </div>
        </section>

        <section className="mx-auto max-w-md px-5 pt-6" aria-labelledby="scores">
          <h2 id="scores" className="mb-3 text-lg font-bold">How {name} scored</h2>
          <ul className="space-y-4">
            {r.dimensions.map(d => {
              const [a, b] = DIMENSIONS[d.dimension];
              const leftWins = d.winner === a;
              return (
                <li key={d.dimension}>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span className={leftWins ? 'font-bold' : 'text-gray-600'}>{poleLabel(a, r.animalType)}</span>
                    <span className={!leftWins ? 'font-bold' : 'text-gray-600'}>{poleLabel(b, r.animalType)}</span>
                  </div>
                  <div className={`flex h-2.5 overflow-hidden rounded-full bg-gray-200 ${leftWins ? 'justify-start' : 'justify-end'}`}>
                    <div className="h-2.5 rounded-full bg-purple-700" style={{ width: `${Math.round(d.strength * 100)}%` }} />
                  </div>
                  <p className={`mt-1 text-xs text-gray-600 ${leftWins ? '' : 'text-right'}`}>
                    {d.points} of {d.total} swipes{d.points === Math.ceil(d.total / 2) && !d.tie ? ', a close call' : ''}{d.tie ? ', a bit of both' : ''}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>

        {t && (
          <section className="mx-auto max-w-md px-5 pt-7" aria-labelledby="traits">
            <h2 id="traits" className="mb-3 text-lg font-bold">What makes {name} {t.name.replace(/^The /, 'a ')}</h2>
            <ul className="list-disc space-y-2 pl-5 text-gray-800">
              {(t.traits ?? []).map(x => <li key={x}>{x}</li>)}
              {t.signatureMove && <li><strong>Signature move:</strong> {t.signatureMove}</li>}
            </ul>
            {t.shareQuote && (
              <blockquote className="mt-5 rounded-xl bg-[#F6F2FC] px-5 py-4 text-lg leading-snug">
                &ldquo;{withPetName(t.shareQuote, name)}&rdquo;
              </blockquote>
            )}
          </section>
        )}

        <section className="mx-auto max-w-md px-5 py-8">
          <Link href="/browse" className="flex h-[52px] items-center justify-center rounded-xl bg-purple-700 font-bold text-white hover:bg-purple-800">
            Find {name}&rsquo;s Pawtrait
          </Link>
          <Link href={`/quiz/pawsonality?animal=${r.animalType}`} className="mt-4 inline-block text-sm font-semibold text-purple-800 underline">
            Do the quiz for another pet
          </Link>
        </section>
      </main>
    </div>
  );
}
