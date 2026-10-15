'use client';

/** Corner tab on a picture: "Put Biscuit in this picture" → the design's customise page */
import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export default function PutPetCta({ imageId, petName, src, onClick }: { imageId: string; petName?: string | null; src: string; onClick?: () => void }) {
  const who = petName?.trim() || 'your pet';
  return (
    <Link href={`/customise/${imageId}?start=photo&src=${src}`} onClick={onClick}
      className="absolute right-0 top-0 z-10 inline-flex max-w-[85%] items-center gap-1.5 rounded-bl-2xl bg-purple-700/95 px-3 py-2 text-sm font-bold text-white shadow-md hover:bg-purple-800">
      <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">Put {who} in this picture</span>
    </Link>
  );
}
