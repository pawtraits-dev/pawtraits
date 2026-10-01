'use client';

/**
 * My pets: each pet's Pawsonality (type chip linking to the result), or, while the quiz is live,
 * "What's Biscuit's Pawsonality?" which starts the quiz with the pet's name and breed filled in
 * and saves the type to that pet. Data: GET /api/customers/pets/pawsonality (one call per page).
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';

interface PetType { animal: string | null; code: string | null; name: string | null; shareCode: string | null }
export interface PawsonalityData { live: { dog: boolean; cat: boolean }; pets: Record<string, PetType> }

export function usePetPawsonalities(enabled: boolean): PawsonalityData | null {
  const [data, setData] = useState<PawsonalityData | null>(null);
  useEffect(() => {
    if (!enabled) return;
    fetch('/api/customers/pets/pawsonality', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => setData(d?.pets ? d : null))
      .catch(() => setData(null));
  }, [enabled]);
  return data;
}

export default function PetPawsonality({ data, pet }: {
  data: PawsonalityData | null;
  pet: { pet_id: string; name: string; breed_id?: string };
}) {
  if (!data) return null;
  const info = data.pets[pet.pet_id];
  if (info?.code) {
    const chip = (
      <>
        <span className="rounded bg-gray-900 px-1.5 py-0.5 text-xs font-bold tracking-[0.08em] text-white">{info.code}</span>
        <span className="truncate">{info.name ?? 'Pawsonality'}</span>
      </>
    );
    return info.shareCode ? (
      <Link href={`/quiz/pawsonality/r/${info.shareCode}`} onClick={e => e.stopPropagation()}
        className="mt-3 flex items-center gap-2 text-sm font-semibold text-purple-800 hover:underline">{chip}</Link>
    ) : (
      <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-gray-800">{chip}</p>
    );
  }

  const animal = info?.animal === 'cat' ? 'cat' : 'dog';
  if (!data.live[animal]) return null;
  const qs = new URLSearchParams({ animal, src: 'my-pets', pet: pet.pet_id, name: pet.name });
  if (pet.breed_id) qs.set('breed', pet.breed_id);
  return (
    <Link href={`/quiz/pawsonality?${qs}`} onClick={e => e.stopPropagation()}
      className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-purple-700 hover:underline">
      <Sparkles className="h-4 w-4" aria-hidden="true" /> What&rsquo;s {pet.name}&rsquo;s Pawsonality?
    </Link>
  );
}
