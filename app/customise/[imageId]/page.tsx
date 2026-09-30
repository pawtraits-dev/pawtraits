'use client';

/**
 * Customise page: mobile-first. Works without an account (guest previews, limited per
 * device per day by an admin setting).
 *
 *   ┌ hero image ──────────────┐
 *   │ 🐾 Put my pet in this    │  → photo step → generating → result → buy
 *   │ 🛍️ Buy this print        │  → stall: take it home now (pay on phone)
 *   └──────────────────────────┘     online: delivered print options
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Camera, ImagePlus, Sparkles, ShoppingBag, Share2, RotateCcw, Check, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import UserAwareNavigation from '@/components/UserAwareNavigation';
import { CountryProvider } from '@/lib/country-context';
import StickyActionBar from '@/components/customise/StickyActionBar';
import BasketBar from '@/components/customise/BasketBar';
import { preparePetPhoto } from '@/lib/client/resize-photo';
import { track } from '@/lib/tracking/events';
import BuyOptionsSheet, { type BuyTarget } from '@/components/customise/BuyOptionsSheet';
import { customPortraitTitle } from '@/lib/cart/items';
import { extractDescriptionTitle } from '@/lib/utils';

interface Pet {
  pet_id: string;
  name: string;
  breed_name?: string;
  primary_photo_url?: string;
  animal_type?: 'dog' | 'cat';
}

interface CatalogImage {
  id: string;
  description: string;
  imageUrl: string;
  theme?: { name: string; displayName?: string };
  style?: { name: string; displayName?: string };
  breed?: { name: string; displayName?: string };
  format?: { id: string; name: string; aspectRatio: string };
  isMultiSubject?: boolean;
  subjectCount?: number;
}

interface CustomImage {
  id: string;
  pet_name?: string | null;
  generated_image_url: string | null;
  share_token: string | null;
  status: 'pending' | 'generating' | 'complete' | 'failed';
}

interface StallOffer {
  available: boolean;
  locationName?: string;
  locationCode?: string;
  size?: 'S' | 'M' | 'L';
  pricePence?: number;
  listPricePence?: number;
  discountPct?: number;
}

type Step = 'choose' | 'photo' | 'generating' | 'result' | 'failed' | 'limit';

const PROGRESS_IMAGES = [
  'https://res.cloudinary.com/dnhzfz8xv/image/upload/v1770800877/pawcasso-progress-1_selbwy.png',
  'https://res.cloudinary.com/dnhzfz8xv/image/upload/v1770811121/pawcasso-progress-4_epyie9.png',
  'https://res.cloudinary.com/dnhzfz8xv/image/upload/v1770800877/pawcasso-progress-2_m14aix.png',
  'https://res.cloudinary.com/dnhzfz8xv/image/upload/v1770800876/pawcasso-progress-3_sxffsu.png',
];
const FAIL_IMAGE = 'https://res.cloudinary.com/dnhzfz8xv/image/upload/v1770809160/pawcasso-progress-fail_nusyud.png';
const POLL_MS = 2500;
const POLL_TIMEOUT_MS = 4 * 60 * 1000;
const SIZE_LABEL: Record<string, string> = { S: 'Small', M: 'Medium', L: 'Large' };

const gbp = (p?: number) => (p === undefined ? '' : `£${(p / 100).toFixed(p % 100 === 0 ? 0 : 2)}`);
const ratio = (ar?: string) => ({ aspectRatio: ar ? ar.replace(':', ' / ') : '1 / 1' });
/** Hero sized so the page's main buttons stay above the fold on a phone */
const heroStyle = (ar: string | undefined, maxVh: number) => {
  const [w, h] = (ar || '1:1').split(':').map(Number);
  const r = w && h ? w / h : 1;
  const height = `min(${maxVh}dvh, calc((min(100vw, 36rem) - 2rem) / ${r}))`;
  return { aspectRatio: `${w || 1} / ${h || 1}`, height, width: 'auto', maxWidth: '100%' } as React.CSSProperties;
};
const lifeSavers = { fontFamily: 'var(--font-life-savers), cursive' };

export default function CustomisePage() {
  const params = useParams();
  const { toast } = useToast();
  const imageId = params.imageId as string;

  const [catalogImage, setCatalogImage] = useState<CatalogImage | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [stallOffer, setStallOffer] = useState<StallOffer | null>(null);
  const [fromQr, setFromQr] = useState(false);
  const [scannedSize, setScannedSize] = useState<string | null>(null);

  const [step, setStep] = useState<Step>('choose');
  const [subjects, setSubjects] = useState<Array<{ pet: Pet | null; file: File | null; preview: string | null }>>([{ pet: null, file: null, preview: null }]);
  const [preparing, setPreparing] = useState(false);
  const [customImage, setCustomImage] = useState<CustomImage | null>(null);
  const [progressIndex, setProgressIndex] = useState(0);
  const [rating, setRating] = useState(0);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const [buySheet, setBuySheet] = useState<'catalog' | 'custom' | null>(null);
  const photoSectionRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const subjectCount = catalogImage?.subjectCount || 1;
  const trackItem = catalogImage ? { id: catalogImage.id, name: catalogImage.description?.slice(0, 80), category: catalogImage.theme?.name } : null;

  // ---- load ----
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const size = qs.get('size')?.toUpperCase() || null;
    if (qs.get('src') === 'qr') {
      setFromQr(true);
      if (size && ['S', 'M', 'L'].includes(size)) {
        setScannedSize(size);
        try { sessionStorage.setItem('pt_qr_size', size); } catch { /* private mode */ }
      }
    }
    if (qs.get('start') === 'photo') setStep('photo');
    if (qs.get('buy') === '1') setBuySheet('catalog');

    (async () => {
      try {
        const res = await fetch(`/api/public/catalog-images/${imageId}`);
        if (!res.ok) throw new Error('We couldn’t find that design.');
        const data: CatalogImage = await res.json();
        setCatalogImage(data);
        const n = data.subjectCount || 1;
        setSubjects(Array.from({ length: n }, () => ({ pet: null, file: null, preview: null })));
        track.viewCustomise({ id: data.id, name: data.description?.slice(0, 80), category: data.theme?.name }, qs.get('src') || undefined);
      } catch (e: any) {
        setLoadError(e.message);
      } finally {
        setLoading(false);
      }
    })();

    fetch('/api/customers/pets', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) { setSignedIn(true); setPets(d.pets || []); } })
      .catch(() => {});

    fetch(`/api/stall/offer?imageId=${encodeURIComponent(imageId)}${size ? `&size=${size}` : ''}`, { credentials: 'include' })
      .then(r => r.json()).then(setStallOffer).catch(() => setStallOffer({ available: false }));

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [imageId]);

  // progress carousel while generating
  useEffect(() => {
    if (step !== 'generating') return;
    setProgressIndex(0);
    const t = setInterval(() => setProgressIndex(i => Math.min(i + 1, PROGRESS_IMAGES.length - 1)), 12000);
    return () => clearInterval(t);
  }, [step]);

  // ---- photo handling ----
  async function onFile(e: React.ChangeEvent<HTMLInputElement>, idx: number) {
    const raw = e.target.files?.[0];
    e.target.value = '';
    if (!raw) return;
    if (!raw.type.startsWith('image/') && !/\.(heic|heif)$/i.test(raw.name)) {
      toast({ title: 'That doesn’t look like a photo', description: 'Please choose a picture of your pet.', variant: 'destructive' });
      return;
    }
    setPreparing(true);
    const file = await preparePetPhoto(raw);
    setPreparing(false);
    if (file.size > 12 * 1024 * 1024) {
      toast({ title: 'Photo too large', description: 'Please pick a smaller photo (under 12MB).', variant: 'destructive' });
      return;
    }
    const preview = URL.createObjectURL(file);
    setSubjects(prev => prev.map((s, i) => (i === idx ? { pet: null, file, preview } : s)));
    if (trackItem) track.photoAdded(trackItem);
  }

  function choosePet(pet: Pet, idx: number) {
    setSubjects(prev => prev.map((s, i) => (i === idx ? { pet, file: null, preview: pet.primary_photo_url || null } : s)));
  }
  function clearSubject(idx: number) {
    setSubjects(prev => prev.map((s, i) => (i === idx ? { pet: null, file: null, preview: null } : s)));
  }

  const allReady = subjects.length > 0 && subjects.every(s => s.pet || s.file);

  function startCustomise() {
    setStep('photo');
    setTimeout(() => photoSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  // ---- generate + poll ----
  const poll = useCallback((id: string) => {
    const started = Date.now();
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/customers/custom-images/${id}`, { credentials: 'include', cache: 'no-store' });
        if (r.ok) {
          const d: CustomImage = await r.json();
          setCustomImage(d);
          if (d.status === 'complete') {
            clearInterval(pollRef.current!);
            setStep('result');
            if (trackItem) track.previewReady(trackItem);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } else if (d.status === 'failed') {
            clearInterval(pollRef.current!);
            setStep('failed');
          }
        }
      } catch { /* keep polling */ }
      if (Date.now() - started > POLL_TIMEOUT_MS) {
        clearInterval(pollRef.current!);
        setStep('failed');
      }
    }, POLL_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogImage]);

  async function generate() {
    if (!allReady || !catalogImage) return;
    const fd = new FormData();
    fd.append('catalogImageId', imageId);
    subjects.forEach((s, i) => {
      const n = subjectCount > 1 ? String(i + 1) : '';
      if (s.pet) fd.append(`petId${n}`, s.pet.pet_id);
      else if (s.file) fd.append(`petPhoto${n}`, s.file);
    });
    setStep('generating');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (trackItem) track.previewRequested(trackItem);
    try {
      const res = await fetch('/api/customers/custom-images/generate', { method: 'POST', credentials: 'include', body: fd });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429 && data.code === 'GUEST_LIMIT_REACHED') {
        setLimitMessage(data.error);
        setStep('limit');
        return;
      }
      if (!res.ok || !data.id) throw new Error(data.error || 'Pawcasso dropped his brush — please try again.');
      setCustomImage(data);
      poll(data.id);
    } catch (e: any) {
      toast({ title: 'Couldn’t start your portrait', description: e.message, variant: 'destructive' });
      setStep('photo');
    }
  }

  function tryAgain() {
    setCustomImage(null);
    setRating(0);
    setSubjects(Array.from({ length: subjectCount }, () => ({ pet: null, file: null, preview: null })));
    setStep('photo');
  }

  async function rate(stars: number) {
    if (!customImage || rating) return;
    setRating(stars);
    fetch(`/api/customers/custom-images/${customImage.id}/rate`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rating: stars }),
    }).catch(() => {});
  }

  async function share() {
    if (!customImage?.share_token) return;
    const url = `${window.location.origin}/share/custom/${customImage.share_token}`;
    try {
      if (navigator.share) await navigator.share({ title: 'My Pawtrait', text: 'Look what Pawcasso made of my pet! 🐾', url });
      else { await navigator.clipboard.writeText(url); toast({ title: 'Link copied!' }); }
    } catch { /* user cancelled */ }
  }

  // ---- buy ----
  // Both open the buy sheet (all sizes & prices, checkout now / add to basket)
  function buyThisPrint() {
    if (!catalogImage) return;
    track.buyThisPrintClicked({ id: catalogImage.id, name: catalogImage.description, variant: stallOffer?.size, price: (stallOffer?.pricePence || 0) / 100 }, stallOffer?.available ? 'stall' : 'online');
    setBuySheet('catalog');
  }
  function buyCustom() {
    if (customImage) setBuySheet('custom');
  }

  const buyTarget: BuyTarget | null = !catalogImage ? null : buySheet === 'custom' && customImage
    ? {
        kind: 'custom', imageId: customImage.id, catalogImageId: catalogImage.id,
        imageUrl: customImage.generated_image_url || catalogImage.imageUrl,
        title: customPortraitTitle(customImage.pet_name, catalogImage.theme?.displayName || catalogImage.theme?.name),
        formatId: catalogImage.format?.id, themeName: catalogImage.theme?.name,
      }
    : {
        kind: 'catalog', imageId: catalogImage.id, catalogImageId: catalogImage.id, imageUrl: catalogImage.imageUrl,
        title: extractDescriptionTitle(catalogImage.description) || 'Pawtraits print', formatId: catalogImage.format?.id, themeName: catalogImage.theme?.name,
      };

  // ---- render ----
  if (loading) {
    return (
      <Shell>
        <div className="mx-auto max-w-xl px-4 pt-4 animate-pulse">
          <div className="aspect-[4/5] rounded-2xl bg-gray-200" />
          <div className="mt-4 h-6 w-2/3 rounded bg-gray-200" />
          <div className="mt-6 h-16 rounded-2xl bg-gray-200" />
          <div className="mt-3 h-16 rounded-2xl bg-gray-200" />
        </div>
      </Shell>
    );
  }
  if (loadError || !catalogImage) {
    return (
      <Shell>
        <div className="mx-auto max-w-md px-6 py-16 text-center">
          <p className="text-lg font-semibold text-gray-900">{loadError || 'Design not found'}</p>
          <Link href="/browse" className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-purple-600 px-6 font-semibold text-white">Browse designs</Link>
        </div>
      </Shell>
    );
  }

  const heroSrc = step === 'result' && customImage?.generated_image_url ? customImage.generated_image_url : catalogImage.imageUrl;
  const themeName = catalogImage.theme?.displayName || catalogImage.theme?.name;

  return (
    <Shell>
      <div className="mx-auto max-w-xl px-4 pt-3 md:pt-6">
        <Link href="/browse" className="inline-flex items-center gap-1 text-sm text-gray-600 py-2">
          <ArrowLeft className="h-4 w-4" /> All designs
        </Link>

        {/* HERO */}
        {step !== 'generating' && step !== 'failed' && step !== 'limit' && (
          <div className="relative mx-auto overflow-hidden rounded-2xl bg-gray-100 shadow-sm select-none"
            style={step === 'result' ? ratio(catalogImage.format?.aspectRatio) : heroStyle(catalogImage.format?.aspectRatio, step === 'photo' ? 30 : 46)}
            onContextMenu={e => e.preventDefault()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroSrc} alt={catalogImage.description || 'Pawtraits design'} className="absolute inset-0 h-full w-full object-contain pointer-events-none" draggable={false} />
            {step === 'result' && (
              <span className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">Preview · watermarked</span>
            )}
          </div>
        )}

        {/* CHOOSE */}
        {step === 'choose' && (
          <>
            <h1 className="mt-4 text-2xl font-bold text-gray-900 leading-tight" style={lifeSavers}>
              {fromQr ? 'Love this one?' : 'Make it yours'}
            </h1>
            <p className="mt-1 text-gray-600">
              {themeName ? `A ${themeName.toLowerCase()} portrait. ` : ''}Take it home as it is, or have Pawcasso paint <em>your</em> pet into it.
            </p>

            {stallOffer?.available && (
              <p className="mt-2 text-sm text-purple-800">
                At the stall? Pay on your phone and take this {SIZE_LABEL[stallOffer.size || 'M'].toLowerCase()} print home now —
                no queue for the card reader, and a free digital copy too 🎁
              </p>
            )}

            {/* Both choices pinned to the bottom of the screen on phones (always visible, thumb-reachable) */}
            <StickyActionBar>
              <BasketBar />
              <button onClick={startCustomise}
                className="flex min-h-16 w-full items-center gap-3 rounded-2xl bg-purple-600 px-4 py-2.5 text-left text-white shadow-lg active:scale-[0.99] transition">
                <span className="text-2xl" aria-hidden>🐾</span>
                <span className="flex-1 leading-tight">
                  <span className="block text-base font-semibold">Put my pet in this picture</span>
                  <span className="block text-xs text-purple-100">Free preview in about a minute · no sign-up</span>
                </span>
              </button>
              <button onClick={buyThisPrint}
                className="flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 border-purple-600 bg-white px-4 py-2 text-left text-purple-900 active:scale-[0.99] transition">
                <span className="text-xl" aria-hidden>🛍️</span>
                <span className="flex-1 leading-tight">
                  <span className="block text-base font-semibold">Buy this print</span>
                  <span className="block text-xs text-purple-700">
                    {stallOffer?.available ? `The one in your hand · free digital copy` : 'Sizes & prices · free digital copy with prints'}
                  </span>
                </span>
                {stallOffer?.available && (
                  <span className="text-right leading-tight">
                    <span className="block font-bold">{gbp(stallOffer.pricePence)}</span>
                    {stallOffer.discountPct ? <span className="block text-xs text-gray-400 line-through">{gbp(stallOffer.listPricePence)}</span> : null}
                  </span>
                )}
              </button>
            </StickyActionBar>
          </>
        )}

        {/* PHOTO */}
        {step === 'photo' && (
          <div ref={photoSectionRef} className="pt-4 scroll-mt-4">
            <h2 className="text-xl font-bold text-gray-900" style={lifeSavers}>
              {subjectCount > 1 ? `Add ${subjectCount} pet photos` : 'Add a photo of your pet'}
            </h2>
            <p className="mt-1 text-sm text-gray-600">Face on, good light, whole head in the picture. Pawcasso does the rest.</p>

            <div className="mt-4 space-y-4">
              {subjects.map((s, idx) => (
                <div key={idx}>
                  {subjectCount > 1 && <p className="mb-2 text-sm font-medium text-gray-800">Pet {idx + 1}</p>}
                  {s.preview ? (
                    <div className="relative flex items-center gap-3 rounded-2xl border-2 border-purple-500 bg-purple-50 p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.preview} alt="" className="h-20 w-20 rounded-xl object-cover bg-purple-100"
                        onError={e => { (e.currentTarget as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 80 80%22><rect width=%2280%22 height=%2280%22 fill=%22%23ede9fe%22/><text x=%2240%22 y=%2250%22 font-size=%2232%22 text-anchor=%22middle%22>🐾</text></svg>'; }} />
                      <div className="flex-1">
                        <p className="font-semibold text-purple-900 flex items-center gap-1"><Check className="h-4 w-4" /> {s.pet ? s.pet.name : 'Photo added'}</p>
                        <button onClick={() => clearSubject(idx)} className="mt-1 text-sm text-purple-700 underline">Change photo</button>
                      </div>
                      <button onClick={() => clearSubject(idx)} aria-label="Remove photo" className="p-2 text-gray-500"><X className="h-5 w-5" /></button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl bg-purple-600 text-white active:scale-[0.99]">
                        <Camera className="h-7 w-7" />
                        <span className="font-semibold">Take a photo</span>
                        <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={e => onFile(e, idx)} />
                      </label>
                      <label className="flex h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-purple-300 bg-white text-purple-800 active:scale-[0.99]">
                        <ImagePlus className="h-7 w-7" />
                        <span className="font-semibold">From my photos</span>
                        <input type="file" accept="image/*,.heic,.heif" className="sr-only" onChange={e => onFile(e, idx)} />
                      </label>
                    </div>
                  )}

                  {!s.preview && signedIn && pets.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Or pick one of your pets</p>
                      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 snap-x">
                        {pets.map(p => (
                          <button key={p.pet_id} onClick={() => choosePet(p, idx)} className="snap-start shrink-0 w-20 text-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {p.primary_photo_url
                              ? <img src={p.primary_photo_url} alt="" className="h-20 w-20 rounded-xl object-cover border" />
                              : <span className="flex h-20 w-20 items-center justify-center rounded-xl bg-gray-100 text-2xl">{p.animal_type === 'cat' ? '🐱' : '🐶'}</span>}
                            <span className="mt-1 block truncate text-xs text-gray-700">{p.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {preparing && <p className="mt-3 text-sm text-gray-500">Getting your photo ready…</p>}
            <p className="mt-4 text-xs text-gray-500">
              Your photo is only used to make your portrait. {!signedIn && <>No account needed — <Link href={`/auth/login?returnTo=/customise/${imageId}`} className="underline">sign in</Link> to use your saved pets.</>}
            </p>

            <StickyActionBar>
              <button onClick={generate} disabled={!allReady || preparing}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-purple-600 text-lg font-semibold text-white shadow-lg disabled:bg-purple-300">
                <Sparkles className="h-5 w-5" /> {allReady ? 'Create my free preview' : subjectCount > 1 ? 'Add all photos to continue' : 'Add a photo to continue'}
              </button>
              <button onClick={() => setStep('choose')} className="h-10 w-full text-sm text-gray-600">Back</button>
            </StickyActionBar>
          </div>
        )}

        {/* GENERATING */}
        {step === 'generating' && (
          <div className="pt-2 text-center">
            <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl">
              <div className="flex transition-transform duration-700 ease-in-out" style={{ transform: `translateX(-${progressIndex * 100}%)` }}>
                {PROGRESS_IMAGES.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={src} alt="" className="w-full shrink-0" />
                ))}
              </div>
            </div>
            <p className="mt-6 text-xl text-gray-800" style={lifeSavers}>
              {[
                'Pawcasso is contemplating his canvas…',
                'Capturing the essence of his new muse…',
                'Getting that personality just right…',
                'Final flourishes — nearly there!',
              ][progressIndex]}
            </p>
            <div className="mx-auto mt-5 h-2 w-56 overflow-hidden rounded-full bg-purple-100">
              <div className="h-full rounded-full bg-purple-600 transition-all duration-[12000ms] ease-linear" style={{ width: `${25 + progressIndex * 25}%` }} />
            </div>
            <p className="mt-4 text-sm text-gray-500">Usually under a minute. Keep this page open.</p>
          </div>
        )}

        {/* RESULT */}
        {step === 'result' && customImage && (
          <>
            <h2 className="mt-4 text-2xl font-bold text-gray-900" style={lifeSavers}>Ta-da! 🎨</h2>
            <p className="mt-1 text-gray-600">Love it? Get it as a print, or a high-res download for your phone.</p>

            <div className="mt-4 rounded-2xl bg-purple-50 p-4 text-center">
              <p className="text-sm font-medium text-purple-900">How did Pawcasso do?</p>
              <div className="mt-2 flex justify-center gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => rate(n)} aria-label={`${n} hearts`}
                    className={`h-11 w-11 text-2xl transition ${n <= rating ? 'scale-110' : 'opacity-40 grayscale'}`}>❤️</button>
                ))}
              </div>
              {rating > 0 && <p className="mt-1 text-xs text-purple-700">Thanks — he’s blushing.</p>}
            </div>

            <StickyActionBar>
              <BasketBar />
              <button onClick={buyCustom} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-purple-600 text-lg font-semibold text-white shadow-lg">
                <ShoppingBag className="h-5 w-5" /> Buy this portrait
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={tryAgain} className="flex h-11 items-center justify-center gap-1 rounded-xl border border-gray-300 text-sm font-medium text-gray-800"><RotateCcw className="h-4 w-4" /> Try another photo</button>
                <button onClick={share} className="flex h-11 items-center justify-center gap-1 rounded-xl border border-gray-300 text-sm font-medium text-gray-800"><Share2 className="h-4 w-4" /> Share</button>
              </div>
            </StickyActionBar>
          </>
        )}

        {/* FAILED */}
        {step === 'failed' && (
          <div className="pt-4 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={FAIL_IMAGE} alt="" className="mx-auto w-full max-w-sm rounded-2xl" />
            <p className="mt-5 text-lg text-gray-800" style={lifeSavers}>Pawcasso is a perfectionist and he isn’t happy with that one. He’d love a second go.</p>
            <p className="mt-2 text-sm text-gray-500">A clear, front-on photo in good light works best.</p>
            <StickyActionBar>
              <button onClick={tryAgain} className="h-14 w-full rounded-2xl bg-purple-600 text-lg font-semibold text-white">Try again</button>
            </StickyActionBar>
          </div>
        )}

        {/* LIMIT */}
        {step === 'limit' && (
          <div className="pt-8 text-center">
            <div className="text-5xl">🎨</div>
            <h2 className="mt-3 text-xl font-bold text-gray-900">Pawcasso needs a breather</h2>
            <p className="mt-2 text-gray-600">{limitMessage}</p>
            <div className="mt-6 space-y-2">
              <Link href="/signup/user" className="flex h-14 w-full items-center justify-center rounded-2xl bg-purple-600 text-lg font-semibold text-white">Create a free account</Link>
              <button onClick={buyThisPrint} className="h-12 w-full rounded-2xl border-2 border-purple-600 font-semibold text-purple-800">Buy this print instead</button>
            </div>
          </div>
        )}
      </div>
      {buyTarget && (
        <BuyOptionsSheet
          open={!!buySheet}
          onClose={() => setBuySheet(null)}
          target={buyTarget}
          stallOffer={buySheet === 'catalog' ? stallOffer : null}
          scannedSize={scannedSize}
        />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <CountryProvider>
      <div className="min-h-[100dvh] bg-gray-50">
        <UserAwareNavigation />
        {children}
      </div>
    </CountryProvider>
  );
}
