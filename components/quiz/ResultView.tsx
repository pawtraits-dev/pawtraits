'use client';

/**
 * Pawsonality result page body (client): picture (upgrading to the breed version), type copy,
 * share, score bars, traits, "Make Biscuit's Pawtrait", save. Data comes from the server page.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { PublicQuizResult } from '@/lib/quiz/results';
import { withPetName } from '@/lib/quiz/scoring';
import { poleLabel } from '@/lib/quiz/admin';
import { DIMENSIONS } from '@/lib/quiz/types';
import { MakePawtrait, ResultHeroPicture, SaveResult, ShareButton } from './ResultActions';

const lifeSavers = { fontFamily: 'var(--font-life-savers), cursive' };

export default function ResultView({ r }: { r: PublicQuizResult }) {
  const t = r.type;
  const name = r.petName;
  const typeName = t?.name ?? r.code;
  const [imageId, setImageId] = useState<string | null>(r.imageId);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    fetch('/api/auth/check', { credentials: 'include' }).then(res => (res.ok ? res.json() : null))
      .then(d => setSignedIn(!!d?.isAuthenticated)).catch(() => {});
  }, []);

  const common = {
    shareCode: r.shareCode, animal: r.animalType, code: r.code, typeName, petName: name,
    breedId: r.breed?.id ?? null, breedName: r.breed?.name ?? null,
    imageId: r.imageId, imageKind: r.imageKind, canPaintBreed: r.canPaintBreed,
  };

  return (
    <main>
      <section className="bg-[#F6F2FC] px-5 pb-7 pt-5">
        <div className="mx-auto max-w-md">
          <ResultHeroPicture {...common} onImage={setImageId} />
          <div className="mt-5 flex items-center gap-2">
            <span className="inline-flex h-7 items-center rounded-md bg-gray-900 px-2.5 text-sm font-bold tracking-[0.08em] text-white">{r.code}</span>
            <span className="text-sm text-gray-700">{name}&rsquo;s Pawsonality</span>
          </div>
          <h1 className="mt-2 text-[2.25rem] leading-[1.08]" style={lifeSavers}>{name} is {typeName}</h1>
          {t?.tagline && <p className="mt-1 text-lg font-semibold text-purple-800">{t.tagline}</p>}
          {t?.ownerReality && <p className="mt-1 text-gray-700">{t.ownerReality}</p>}
          <div className="mt-5"><ShareButton shareCode={r.shareCode} petName={name} typeName={typeName} code={r.code} /></div>
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
        <section className="mx-auto max-w-md px-5 pb-7 pt-7" aria-labelledby="traits">
          <h2 id="traits" className="mb-3 text-lg font-bold">What makes {name} {typeName.replace(/^The /, 'a ')}</h2>
          <ul className="list-disc space-y-2 pl-5 text-gray-800">
            {(t.traits ?? []).map(x => <li key={x}>{x}</li>)}
            {t.signatureMove && <li><strong>Signature move:</strong> {t.signatureMove}</li>}
          </ul>
          {t.shareQuote && (
            <blockquote className="mt-5 rounded-xl bg-[#F6F2FC] px-5 py-4 text-lg leading-snug">&ldquo;{withPetName(t.shareQuote, name)}&rdquo;</blockquote>
          )}
        </section>
      )}

      <MakePawtrait petName={name} typeName={typeName} code={r.code} imageId={imageId} breedId={r.breed?.id ?? null} animal={r.animalType} />

      <section className="mx-auto max-w-md px-5 py-7" aria-labelledby="save">
        <h2 id="save" className="text-lg font-bold">Save {name}&rsquo;s Pawsonality</h2>
        <p className="mb-3 mt-1 text-sm text-gray-700">
          {signedIn ? `Keep it on ${name}’s profile.` : `We’ll email you a link that saves it to ${name}’s profile. Optional.`}
        </p>
        <SaveResult shareCode={r.shareCode} petName={name} signedIn={signedIn} />
        <Link href={`/quiz/pawsonality?animal=${r.animalType}`} className="mt-6 inline-block text-sm font-semibold text-purple-800 underline">
          Do the quiz for another pet
        </Link>
      </section>
    </main>
  );
}
