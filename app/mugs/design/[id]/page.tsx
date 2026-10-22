'use client';

/**
 * A wraparound mug design from the catalogue (2:1, e.g. the football mugs), laid out like the
 * star sign mugs (/mugs/[slug]): the mug on the left, the steps on the right.
 *   1. Team (sports designs: switching opens that team's version here)
 *   2. A photo of your pet
 *   3. Their name and number on the shirt (personalised-kit designs)
 *   4. The big words on the back (designs showing the team motto)
 * "Paint my mug" makes a customised Pawtrait (/api/customers/custom-images/generate) and the
 * result shows both sides of the mug and the mug products to buy.
 */
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Camera, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import UserAwareNavigation from '@/components/UserAwareNavigation';
import { CountryProvider } from '@/lib/country-context';
import BuyOptionsSheet, { type BuyTarget } from '@/components/customise/BuyOptionsSheet';
import BasketBar from '@/components/customise/BasketBar';
import TeamPicker from '@/components/customise/TeamPicker';
import { preparePetPhoto } from '@/lib/client/resize-photo';
import { designTitle, plainText } from '@/lib/text/plain';
import { cleanKitName } from '@/lib/collections/sports-teams';
import { cleanSlogan, SLOGAN_MAX } from '@/lib/collections/slogan';

interface Design {
  id: string;
  description: string | null;
  imageUrl: string;
  format?: { id: string; aspectRatio: string } | null;
  kit?: { name: string; number: number | null; motto?: string | null } | null;
  mugMockups?: { pet?: string; text?: string };
}
interface Custom { id: string; status: string; generated_image_url: string | null; pet_name?: string | null; error_message?: string | null; mugMockups?: { pet?: string; text?: string } }

const lifeSavers = { fontFamily: 'var(--font-life-savers), cursive' };
const PAINTING_LINES = ['Mixing the paints…', 'Sketching your pet…', 'Painting the shirt…', 'Laying out the mug…'];
const POLL_MS = 3000;
const POLL_TIMEOUT_MS = 240_000;

export default function WrapMugPage() {
  const { id } = useParams<{ id: string }>();
  const [design, setDesign] = useState<Design | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(null);
  const [kitName, setKitName] = useState('');
  const [kitNumber, setKitNumber] = useState('');
  const [slogan, setSlogan] = useState('');
  const [sloganTouched, setSloganTouched] = useState(false);
  const [painting, setPainting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Custom | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, tick] = useState(0);
  const [sports, setSports] = useState(false);   // has a team picker

  useEffect(() => {
    setDesign(null); setResult(null); setError(null);
    fetch(`/api/public/catalog-images/${id}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('This mug isn’t available'))))
      .then((d: Design) => {
        setDesign(d);
        if (d.kit) setKitNumber(d.kit.number === null || d.kit.number === undefined ? '' : String(d.kit.number));
        if (d.kit?.motto && !sloganTouched) setSlogan(d.kit.motto.replace(/\n/g, ' '));
      })
      .catch(e => setLoadError(e.message));
    fetch(`/api/public/designs/${id}/teams`).then(r => (r.ok ? r.json() : null)).then(d => setSports(!!d?.switchable)).catch(() => setSports(false));
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!painting) return;
    const t = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, [painting]);

  async function choosePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0];
    e.target.value = '';
    if (!raw) return;
    setError(null);
    const file = await preparePetPhoto(raw);
    if (file.size > 12 * 1024 * 1024) { setError('Please pick a smaller photo (under 12MB).'); return; }
    setPhoto({ file, preview: URL.createObjectURL(file) });
  }

  const hasKit = !!design?.kit;
  const showSlogan = hasKit && !!design?.kit?.motto;
  const nameOk = !hasKit || !!cleanKitName(kitName);
  const sloganOk = !showSlogan || !sloganTouched || !slogan.trim() || !!cleanSlogan(slogan);
  const ready = !!photo && nameOk && sloganOk;

  async function paint() {
    if (!design || !photo || !ready) return;
    setError(null);
    const started = Date.now();
    setPainting(started);
    try {
      const fd = new FormData();
      fd.append('catalogImageId', design.id);
      fd.append('source', 'mugs');
      fd.append('petPhoto', photo.file);
      if (hasKit) { fd.append('kitName', kitName.trim().toUpperCase()); fd.append('kitNumber', kitNumber); }
      if (showSlogan && sloganTouched && slogan.trim()) fd.append('slogan', slogan.trim());
      const res = await fetch('/api/customers/custom-images/generate', { method: 'POST', credentials: 'include', body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.id) throw new Error(d.error || 'Pawcasso dropped his brush. Please try again.');
      await new Promise<void>((resolve, reject) => {
        const check = async () => {
          try {
            const r = await fetch(`/api/customers/custom-images/${d.id}`, { credentials: 'include', cache: 'no-store' });
            if (r.ok) {
              const c: Custom = await r.json();
              if (c.status === 'complete') {
                await Promise.all([c.generated_image_url, c.mugMockups?.pet, c.mugMockups?.text].filter(Boolean).map(s => preload(s as string)));
                setResult(c);
                window.scrollTo({ top: 0, behavior: 'smooth' });
                resolve(); return;
              }
              if (c.status === 'failed') { reject(new Error('Pawcasso couldn’t paint that one. Try a clearer photo of your pet, face in view.')); return; }
            }
          } catch { /* keep polling */ }
          if (Date.now() - started > POLL_TIMEOUT_MS) { reject(new Error('That’s taking longer than usual. Please try again.')); return; }
          pollRef.current = setTimeout(check, POLL_MS);
        };
        pollRef.current = setTimeout(check, POLL_MS);
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPainting(null);
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
  if (!design) return <Shell><p className="py-16 text-center text-gray-500">Loading…</p></Shell>;

  const name = designTitle(design.description, 'Wraparound mug');
  const about = plainText((design.description || '').replace(/\*\*(.+?)\*\*/, '').trim());
  const petName = result?.pet_name && result.pet_name !== 'Uploaded Pet' ? result.pet_name : null;
  const title = `${petName ? `${petName}’s` : 'Your'} ${name} mug`;
  const buyTarget: BuyTarget | null = result
    ? { kind: 'custom', imageId: result.id, catalogImageId: design.id, imageUrl: result.generated_image_url || design.imageUrl, title, formatId: design.format?.id, physicalOnly: true }
    : null;
  const elapsed = painting ? Math.floor((Date.now() - painting) / 1000) : 0;
  const mockups = result?.mugMockups?.pet ? result.mugMockups : design.mugMockups;
  // Step numbers: team (sports designs), photo, shirt (kit designs), big words (motto designs)
  const steps = [sports && 'team', 'photo', hasKit && 'kit', showSlogan && 'slogan'].filter(Boolean) as string[];
  const n = (key: string) => `${steps.indexOf(key) + 1}.`;

  return (
    <Shell>
      <main className="mx-auto max-w-5xl px-4 py-6 pb-28 md:pb-10">
        <Link href="/mugs" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-purple-700"><ArrowLeft className="h-4 w-4" /> All mugs</Link>

        <div className="mt-4 grid gap-8 md:grid-cols-2">
          {/* Picture: both sides of the mug, then the flat design (or the finished painting) */}
          <div className="space-y-3">
            {mockups?.pet && (
              <div className={`grid gap-2 ${mockups.text ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {[mockups.pet, mockups.text].filter(Boolean).map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={src} alt={i === 0 ? `${title}, pet side` : `${title}, back`} className="w-full rounded-2xl bg-white shadow-sm ring-1 ring-gray-200" />
                ))}
              </div>
            )}
            <div className="overflow-hidden rounded-2xl bg-white p-2 shadow-sm ring-1 ring-gray-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result?.generated_image_url || design.imageUrl} alt={title} className="w-full rounded-xl" onContextMenu={e => e.preventDefault()} draggable={false} />
            </div>
            <p className="text-sm text-gray-600">
              {mockups?.pet ? 'Above: both sides of the mug. Below: the' : 'The'} full design that wraps around your 11oz mug{result ? '' : ', shown with the sample name'}.
            </p>
          </div>

          {/* Details and steps */}
          <div>
            <h1 className="text-4xl text-gray-900" style={lifeSavers}>{name}</h1>
            <p className="font-semibold text-gray-800">Wraparound 11oz mug</p>
            {about && <p className="mt-2 text-gray-700">{about}</p>}

            {!result && (
              <div className="mt-6 space-y-5">
                {sports && (
                  <div className={painting ? 'pointer-events-none opacity-60' : ''}>
                    <p className="text-sm font-semibold text-gray-900">{n('team')} Your team</p>
                    <div className="mt-2"><TeamPicker imageId={design.id} hrefFor={teamId => `/mugs/design/${teamId}`} /></div>
                  </div>
                )}

                <div>
                  <p className="text-sm font-semibold text-gray-900">{n('photo')} A photo of your pet</p>
                  <input ref={fileRef} type="file" accept="image/*,.heic,.heif" className="hidden" onChange={choosePhoto} />
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={!!painting}
                    className="mt-2 flex items-center gap-3 rounded-xl border-2 border-dashed border-purple-200 bg-white p-3 text-left hover:border-purple-400 disabled:opacity-60">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo.preview} alt="Your pet" className="h-16 w-16 rounded-lg object-cover" />
                    ) : (
                      <span className="grid h-16 w-16 place-items-center rounded-lg bg-purple-50"><Camera className="h-6 w-6 text-purple-600" /></span>
                    )}
                    <span className="text-sm text-gray-700">{photo ? 'Change photo' : 'Choose a clear photo of one pet, face in view'}</span>
                  </button>
                </div>

                {hasKit && (
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{n('kit')} Their name and number on the shirt</p>
                    <div className="mt-2 flex gap-3">
                      <input value={kitName} onChange={e => setKitName(e.target.value.toUpperCase().replace(/[^A-Z '‘’\-]/g, '').slice(0, 12))}
                        placeholder={design.kit?.name || 'BISCUIT'} aria-label="Name on the shirt" autoCapitalize="characters" autoComplete="off" maxLength={12} disabled={!!painting}
                        className="h-12 min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-4 text-lg font-semibold uppercase tracking-wide placeholder:font-normal placeholder:text-gray-400" />
                      <input value={kitNumber} onChange={e => setKitNumber(e.target.value.replace(/\D/g, '').slice(0, 2))}
                        placeholder="–" aria-label="Number on the shirt" inputMode="numeric" maxLength={2} disabled={!!painting}
                        className="h-12 w-20 rounded-xl border border-gray-300 bg-white px-3 text-center text-lg font-semibold" />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">Painted on the back of the shirt · up to 12 letters · leave the number empty for just the name</p>
                    {kitName.trim() && !nameOk && <p role="alert" className="mt-1 text-sm text-red-700">Letters only please (spaces, hyphens and apostrophes are fine), and nothing rude.</p>}
                  </div>
                )}

                {showSlogan && (
                  <div>
                    <label htmlFor="slogan" className="text-sm font-semibold text-gray-900">{n('slogan')} The big words on the back</label>
                    <input id="slogan" value={slogan} onChange={e => { setSlogan(e.target.value.toUpperCase().slice(0, SLOGAN_MAX)); setSloganTouched(true); }}
                      maxLength={SLOGAN_MAX} autoCapitalize="characters" autoComplete="off" disabled={!!painting}
                      className="mt-2 h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-base font-semibold uppercase tracking-wide" />
                    <p className="mt-1 text-xs text-gray-500">
                      The team&apos;s motto. Keep it or write your own · up to {SLOGAN_MAX} characters
                      {sloganTouched && slogan.trim() !== (design.kit?.motto ?? '').replace(/\n/g, ' ') && (
                        <button type="button" onClick={() => { setSlogan((design.kit?.motto ?? '').replace(/\n/g, ' ')); setSloganTouched(false); }} className="ml-1 text-purple-700 underline">Use the team motto</button>
                      )}
                    </p>
                    {!sloganOk && <p role="alert" className="mt-1 text-sm text-red-700">Letters, numbers and simple punctuation only, and nothing rude.</p>}
                  </div>
                )}

                {error && <p className="text-sm text-red-700">{error}</p>}

                <button type="button" onClick={paint} disabled={!ready || !!painting}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-purple-600 text-lg font-semibold text-white shadow-lg disabled:opacity-50">
                  {painting
                    ? <><Loader2 className="h-5 w-5 animate-spin" /> {PAINTING_LINES[Math.min(Math.floor(elapsed / 12), PAINTING_LINES.length - 1)]} {elapsed}s</>
                    : <><Sparkles className="h-5 w-5" /> {!photo ? 'Add a photo to continue' : !nameOk ? 'Add their name for the shirt' : 'Paint my mug'}</>}
                </button>
                {painting && <p className="text-center text-xs text-gray-500">Usually under a minute. Keep this page open.</p>}
              </div>
            )}

            {result && buyTarget && (
              <div className="mt-6 space-y-5">
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

function preload(src: string): Promise<void> {
  return new Promise(resolve => {
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
