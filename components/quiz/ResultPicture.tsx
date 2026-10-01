'use client';

/**
 * The result picture. Shows the breed version when it exists; otherwise the type's design with
 * "Painting Biscuit as a Labrador…", asks for the breed version (POST breed-image, which starts it
 * if the quiz didn't), polls until it's ready (up to ~3 minutes), then swaps it in.
 */
import { useEffect, useRef, useState } from 'react';
import { PawPrint } from 'lucide-react';

const POLL_MS = 5000;
const GIVE_UP_MS = 180_000;

export default function ResultPicture({
  shareCode, animal, code, breedId, breedName, petName, initialImageId, canPaintBreed, onImage,
}: {
  shareCode: string; animal: 'dog' | 'cat'; code: string;
  breedId: string | null; breedName: string | null; petName: string;
  initialImageId: string | null; initialKind?: 'breed' | 'design' | null; canPaintBreed: boolean;
  /** Tells the page which picture is showing (for the "Put Biscuit in this Pawtrait" link) */
  onImage?: (imageId: string) => void;
}) {
  const [imageId, setImageId] = useState(initialImageId);
  const [painting, setPainting] = useState(canPaintBreed && !!breedId);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  // A picture that loaded before hydration never fires onLoad for React
  useEffect(() => { const el = imgRef.current; if (el?.complete && el.naturalWidth > 0) setLoaded(true); }, [imageId]);

  useEffect(() => {
    if (!canPaintBreed || !breedId) return;
    let stop = false;
    const started = Date.now();
    const ask = async (peek: boolean): Promise<void> => {
      try {
        const r = await fetch('/api/public/quiz/pawsonality/breed-image', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ animal, code, breedId, shareCode, peek }),
        });
        const body = await r.json().catch(() => ({}));
        if (stop) return;
        if (body.status === 'done' && body.imageId) {
          setLoaded(false); setImageId(body.imageId); setPainting(false); onImage?.(body.imageId);
          return;
        }
        if (body.status === 'pending' && Date.now() - started < GIVE_UP_MS) {
          setTimeout(() => { if (!stop) ask(true); }, POLL_MS);
          return;
        }
      } catch { /* fall through */ }
      if (!stop) setPainting(false);
    };
    ask(false);
    return () => { stop = true; };
  }, [canPaintBreed, breedId, animal, code, shareCode]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative overflow-hidden rounded-2xl bg-purple-100" style={{ aspectRatio: '2 / 3' }}>
      {imageId ? (
        <img
          key={imageId}
          ref={imgRef}
          src={`/api/secure-images/${imageId}?variant=full_size`}
          alt={`${petName}’s Pawsonality Pawtrait`}
          onLoad={() => setLoaded(true)}
          className={`h-full w-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[repeating-linear-gradient(135deg,#efe9f8_0_16px,#f6f2fc_16px_32px)]" aria-hidden="true">
          <PawPrint className="h-24 w-24 text-purple-300" />
        </div>
      )}
      {painting && (
        <div className="absolute inset-x-3 bottom-3 flex items-center gap-2.5 rounded-xl bg-[#2A1A52]/85 px-3.5 py-2.5 text-sm font-semibold text-white" role="status">
          <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
          Painting {petName} as {breedName ? `a ${breedName}` : 'their breed'}…
        </div>
      )}
    </div>
  );
}
