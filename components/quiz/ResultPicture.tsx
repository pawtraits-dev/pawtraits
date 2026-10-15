'use client';

/**
 * The result picture(s). The first is the breed version when it exists; otherwise the type's
 * design with "Painting Biscuit as a Labrador…", asks for the breed version (POST breed-image,
 * which starts it if the quiz didn't), polls until it's ready (up to ~3 minutes), then swaps it in.
 * The type's other designs (other styles) follow in a swipeable carousel. Every picture has a
 * "Put Biscuit in this picture" corner tab to its customise page.
 */
import { useEffect, useRef, useState } from 'react';
import { PawPrint } from 'lucide-react';
import PutPetCta from './PutPetCta';
import { track } from '@/lib/tracking/events';

const POLL_MS = 5000;
const GIVE_UP_MS = 180_000;

export default function ResultPicture({
  shareCode, animal, code, breedId, breedName, petName, initialImageId, canPaintBreed, onImage, extraImageIds = [],
}: {
  shareCode: string; animal: 'dog' | 'cat'; code: string;
  breedId: string | null; breedName: string | null; petName: string;
  initialImageId: string | null; initialKind?: 'breed' | 'design' | null; canPaintBreed: boolean;
  /** Tells the page which picture is showing (for the "Add Biscuit's photo" button) */
  onImage?: (imageId: string) => void;
  extraImageIds?: string[];
}) {
  const [imageId, setImageId] = useState(initialImageId);
  const [painting, setPainting] = useState(canPaintBreed && !!breedId);
  const [loaded, setLoaded] = useState(false);
  const [slide, setSlide] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
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
          setLoaded(false); setImageId(body.imageId); setPainting(false);
          if (slideRef.current === 0) onImage?.(body.imageId);
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

  const extras = extraImageIds.filter(id => id !== imageId);
  const slides = [imageId, ...extras];
  const many = extras.length > 0;
  const slideRef = useRef(0);

  // Which slide is showing (the page's "Add photo" button follows it)
  function onScroll() {
    const el = trackRef.current;
    if (!el) return;
    const width = (el.firstElementChild as HTMLElement | null)?.offsetWidth || el.clientWidth;
    const i = Math.round(el.scrollLeft / (width + 12));
    if (i !== slideRef.current && i >= 0 && i < slides.length) {
      slideRef.current = i; setSlide(i);
      const id = slides[i];
      if (id) onImage?.(id);
    }
  }
  const goTo = (i: number) => {
    const el = trackRef.current;
    const child = el?.children[i] as HTMLElement | undefined;
    if (el && child) el.scrollTo({ left: child.offsetLeft - el.offsetLeft - (el.clientWidth - child.offsetWidth) / 2, behavior: 'smooth' });
  };
  const cta = (id: string) => <PutPetCta imageId={id} petName={petName} src="pawsonality" onClick={() => track.quizResultDesignClick('pawsonality', code, id)} />;

  const main = (
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
      {imageId && !painting && cta(imageId)}
      {painting && (
        <div className="absolute inset-x-3 bottom-3 flex items-center gap-2.5 rounded-xl bg-[#2A1A52]/85 px-3.5 py-2.5 text-sm font-semibold text-white" role="status">
          <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
          Painting {petName} as {breedName ? `a ${breedName}` : 'their breed'}…
        </div>
      )}
    </div>
  );

  if (!many) return main;

  return (
    <div>
      <div ref={trackRef} onScroll={onScroll} aria-roledescription="carousel" aria-label={`${petName}’s Pawsonality pictures`}
        className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="w-[86%] shrink-0 snap-center" aria-label={`Picture 1 of ${slides.length}`}>{main}</div>
        {extras.map((id, i) => (
          <div key={id} className="w-[86%] shrink-0 snap-center" aria-label={`Picture ${i + 2} of ${slides.length}`}>
            <div className="relative overflow-hidden rounded-2xl bg-purple-100" style={{ aspectRatio: '2 / 3' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/secure-images/${id}?variant=mid_size&w=800`} alt={`Another ${petName} Pawsonality picture`} loading="lazy" className="h-full w-full object-cover" />
              {cta(id)}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-center gap-1.5" aria-hidden="true">
        {slides.map((_, i) => (
          <button key={i} type="button" tabIndex={-1} onClick={() => goTo(i)}
            className={`h-2 rounded-full transition-all ${i === slide ? 'w-5 bg-purple-700' : 'w-2 bg-purple-200'}`} />
        ))}
        <span className="ml-2 text-xs text-gray-600">Swipe for more styles</span>
      </div>
    </div>
  );
}
