'use client';

/**
 * One mug design: add a photo, the pet's name and a colour → Pawcasso paints the pet into the
 * design's scene and lays out the mug wrap → buy it (Mug products, via the usual buy sheet).
 * The finished wrap is saved as a customised Pawtrait (see lib/mugs/server.ts).
 */
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Camera, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import UserAwareNavigation from '@/components/UserAwareNavigation';
import { CountryProvider } from '@/lib/country-context';
import BuyOptionsSheet, { type BuyTarget } from '@/components/customise/BuyOptionsSheet';
import BasketBar from '@/components/customise/BasketBar';
import { preparePetPhoto } from '@/lib/client/resize-photo';
import { plainText } from '@/lib/text/plain';

interface MugEntry { id: string; slug: string; name: string; sub_heading: string; description: string; description_short?: string | null; catalog_image_url: string }
interface MugColour { id: string; name: string; slug: string; hex: string }
interface Result { generationId: string; customImageId: string; previewUrl: string; formatId: string | null; colour: string }

const lifeSavers = { fontFamily: 'var(--font-life-savers), cursive' };
const PAINTING_LINES = ['Mixing the paints…', 'Sketching your pet…', 'Adding the details…', 'Laying out the mug…'];

export default function MugPage() {
  const { slug } = useParams<{ slug: string }>();
  const [entry, setEntry] = useState<MugEntry | null>(null);
  const [colours, setColours] = useState<MugColour[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [photo, setPhoto] = useState<{ preview: string; publicId: string | null; uploading: boolean } | null>(null);
  const [petName, setPetName] = useState('');
  const [colour, setColour] = useState<string>('');
  const [painting, setPainting] = useState<number | null>(null); // started at
  const [recolouring, setRecolouring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch(`/api/mugs/catalog/${slug}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error('This mug isn’t available')))),
      fetch('/api/mugs/colours').then((r) => (r.ok ? r.json() : [])),
    ]).then(([e, c]) => {
      setEntry(e);
      const list = Array.isArray(c) ? c : [];
      setColours(list);
      setColour(list[0]?.slug ?? '');
    }).catch((e) => setLoadError(e.message));
  }, [slug]);

  useEffect(() => {
    if (!painting) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [painting]);

  async function choosePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0];
    e.target.value = '';
    if (!raw) return;
    setError(null);
    const file = await preparePetPhoto(raw);
    const preview = URL.createObjectURL(file);
    setPhoto({ preview, publicId: null, uploading: true });
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/mugs/upload', { method: 'POST', body: fd, credentials: 'include' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.public_id) throw new Error(d.error || 'Upload failed');
      setPhoto({ preview, publicId: d.public_id, uploading: false });
    } catch (err: any) {
      setPhoto(null);
      setError(err.message || 'Upload failed. Please try another photo.');
    }
  }

  async function paint() {
    if (!entry || !photo?.publicId || !petName.trim() || !colour) return;
    setError(null);
    setPainting(Date.now());
    try {
      const res = await fetch('/api/mugs/generate', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catalog_slug: entry.slug, pet_photo_public_id: photo.publicId, pet_name: petName.trim(), mug_colour_slug: colour }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.custom_image_id) throw new Error(d.error || 'Pawcasso dropped his brush. Please try again.');
      await preload(d.preview_url);
      setResult({ generationId: d.generation_id, customImageId: d.custom_image_id, previewUrl: d.preview_url, formatId: d.format_id, colour });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPainting(null);
    }
  }

  async function recolour(slugValue: string) {
    if (!result || slugValue === result.colour) return;
    setColour(slugValue);
    setRecolouring(true);
    setError(null);
    try {
      const res = await fetch('/api/mugs/recolour', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generation_id: result.generationId, mug_colour_slug: slugValue }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Couldn’t change the colour');
      await preload(d.preview_url);
      setResult((r) => (r ? { ...r, previewUrl: d.preview_url, colour: slugValue } : r));
    } catch (err: any) {
      setError(err.message);
      setColour(result.colour);
    } finally {
      setRecolouring(false);
    }
  }

  function startAgain() {
    setResult(null);
    setPhoto(null);
    setError(null);
  }

  if (loadError) {
    return (
      <Shell>
        <main className="mx-auto max-w-xl px-4 py-12 text-center">
          <p className="text-gray-700">{loadError}</p>
          <Link href="/mugs" className="mt-4 inline-block text-purple-700 underline">See all mugs</Link>
        </main>
      </Shell>
    );
  }
  if (!entry) return <Shell><p className="py-16 text-center text-gray-500">Loading…</p></Shell>;

  const title = `${petName.trim() || 'Your pet'}’s ${entry.name} mug`;
  const buyTarget: BuyTarget | null = result
    ? { kind: 'custom', imageId: result.customImageId, catalogImageId: entry.id, imageUrl: result.previewUrl, title, formatId: result.formatId, themeName: entry.name, physicalOnly: true }
    : null;
  const elapsed = painting ? Math.floor((Date.now() - painting) / 1000) : 0;
  const ready = !!photo?.publicId && !!petName.trim() && !!colour;

  return (
    <Shell>
      <main className="mx-auto max-w-5xl px-4 py-6 pb-28 md:pb-10">
        <Link href="/mugs" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-purple-700"><ArrowLeft className="h-4 w-4" /> All mugs</Link>

        <div className="mt-4 grid gap-8 md:grid-cols-2">
          {/* Picture: the design, or the finished wrap */}
          <div>
            {result ? (
              <div className="space-y-3">
                <div className="relative overflow-hidden rounded-2xl bg-white p-2 shadow-sm ring-1 ring-gray-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={result.previewUrl} alt={title} className={`w-full rounded-xl transition-opacity ${recolouring ? 'opacity-40' : ''}`} />
                  {recolouring && <Loader2 className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 animate-spin text-purple-600" />}
                </div>
                <p className="text-sm text-gray-600">The full design that wraps around your 11oz mug: {petName.trim() || 'your pet'} on one side, the {entry.name} story on the other.</p>
              </div>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={entry.catalog_image_url.replace('/image/upload/', '/image/upload/c_limit,w_900,f_auto,q_auto/')} alt={`${entry.name} mug design`} className="w-full rounded-2xl shadow-sm ring-1 ring-gray-200" />
            )}
          </div>

          {/* Details and steps */}
          <div>
            <h1 className="text-4xl text-gray-900" style={lifeSavers}>{entry.name}</h1>
            <p className="font-semibold text-gray-800">{plainText(entry.sub_heading)}</p>
            <p className="mt-2 text-gray-700">{plainText(entry.description_short) || plainText(entry.description)}</p>

            {!result && (
              <div className="mt-6 space-y-5">
                <div>
                  <p className="text-sm font-semibold text-gray-900">1. A photo of your pet</p>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={choosePhoto} />
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={!!painting}
                    className="mt-2 flex items-center gap-3 rounded-xl border-2 border-dashed border-purple-200 bg-white p-3 text-left hover:border-purple-400 disabled:opacity-60">
                    {photo ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={photo.preview} alt="Your pet" className="h-16 w-16 rounded-lg object-cover" />
                    ) : (
                      <span className="grid h-16 w-16 place-items-center rounded-lg bg-purple-50"><Camera className="h-6 w-6 text-purple-600" /></span>
                    )}
                    <span className="text-sm text-gray-700">
                      {photo?.uploading ? 'Uploading…' : photo ? 'Change photo' : 'Choose a clear photo of one pet, face in view'}
                    </span>
                  </button>
                </div>

                <div>
                  <label htmlFor="pet-name" className="text-sm font-semibold text-gray-900">2. Their name</label>
                  <input id="pet-name" value={petName} onChange={(e) => setPetName(e.target.value.slice(0, 20))} maxLength={20} placeholder="e.g. Daisy"
                    className="mt-2 h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-base" disabled={!!painting} />
                  <p className="mt-1 text-xs text-gray-500">Printed under their picture · up to 20 letters</p>
                </div>

                <div>
                  <p className="text-sm font-semibold text-gray-900">3. Mug colour</p>
                  <ColourPicker colours={colours} value={colour} onChange={setColour} disabled={!!painting} />
                </div>

                {error && <p className="text-sm text-red-700">{error}</p>}

                <button type="button" onClick={paint} disabled={!ready || !!painting}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-purple-600 text-lg font-semibold text-white shadow-lg disabled:opacity-50">
                  {painting ? <><Loader2 className="h-5 w-5 animate-spin" /> {PAINTING_LINES[Math.min(Math.floor(elapsed / 6), PAINTING_LINES.length - 1)]} {elapsed}s</> : <><Sparkles className="h-5 w-5" /> Paint my mug</>}
                </button>
                {painting && <p className="text-center text-xs text-gray-500">Usually 20–30 seconds. Keep this page open.</p>}
              </div>
            )}

            {result && buyTarget && (
              <div className="mt-6 space-y-5">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Mug colour</p>
                  <ColourPicker colours={colours} value={colour} onChange={recolour} disabled={recolouring} />
                </div>
                {error && <p className="text-sm text-red-700">{error}</p>}
                <BuyOptionsSheet inline open onClose={() => {}} target={buyTarget} />
                <BasketBar />
                <button type="button" onClick={startAgain} className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-purple-700">
                  <RotateCcw className="h-4 w-4" /> Start again with another photo
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </Shell>
  );
}

function ColourPicker({ colours, value, onChange, disabled }: { colours: MugColour[]; value: string; onChange: (slug: string) => void; disabled?: boolean }) {
  return (
    <div className="mt-2 flex flex-wrap gap-3" role="radiogroup" aria-label="Mug colour">
      {colours.map((c) => (
        <button key={c.slug} type="button" role="radio" aria-checked={value === c.slug} onClick={() => onChange(c.slug)} disabled={disabled}
          className="flex flex-col items-center gap-1 disabled:opacity-60">
          <span className={`h-10 w-10 rounded-full ring-2 ring-offset-2 ${value === c.slug ? 'ring-purple-600' : 'ring-transparent'}`} style={{ backgroundColor: `#${c.hex}` }} />
          <span className="text-xs text-gray-700">{c.name}</span>
        </button>
      ))}
    </div>
  );
}

function preload(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    const t = setTimeout(resolve, 15000);
    img.onload = img.onerror = () => { clearTimeout(t); resolve(); };
    img.src = src;
  });
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
