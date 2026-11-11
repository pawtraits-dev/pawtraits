'use client';

/**
 * One phone-case design, laid out like the mugs (/mugs/design/[id]): the case on the left, the
 * steps on the right.
 *   1. Your phone (iPhone / Galaxy, the models we sell)
 *   2. A photo of your pet
 *   3. Their name and number on the shirt (personalised-kit designs)
 * "Paint my case" makes a customised Pawtrait with the main customisation
 * (/api/customers/custom-images/generate: same prompt and model as every Pawtrait), then drops it
 * into the design's case art for the chosen phone (/api/phone-cases/composite). The pet keeps
 * exactly the place and size it has in the design. The design can also be bought as shown.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Camera, Loader2, RotateCcw, ShoppingBag, Sparkles } from 'lucide-react';
import UserAwareNavigation from '@/components/UserAwareNavigation';
import { CountryProvider } from '@/lib/country-context';
import BasketBar from '@/components/customise/BasketBar';
import CasePreview from '@/components/phone-cases/CasePreview';
import { useHybridCart } from '@/lib/hybrid-cart-context';
import { useToast } from '@/components/ui/use-toast';
import { track } from '@/lib/tracking/events';
import { preparePetPhoto } from '@/lib/client/resize-photo';
import { plainText } from '@/lib/text/plain';
import { cleanKitName } from '@/lib/collections/sports-teams';
import type { PublicCaseDesign, PublicPhoneModel } from '@/lib/phone-cases/public';
import type { PhoneLayoutGroup } from '@/lib/phone-cases/geometry';

interface Custom { id: string; status: string; generated_image_url: string | null; pet_name?: string | null }
interface DesignInfo { id: string; description: string | null; kit?: { name: string; number: number | null } | null }

const lifeSavers = { fontFamily: 'var(--font-life-savers), cursive' };
const PAINTING_LINES = ['Mixing the paints…', 'Sketching your pet…', 'Painting the details…', 'Fitting it to your phone…'];
const POLL_MS = 3000;
const POLL_TIMEOUT_MS = 240_000;
const BRANDS = [{ id: 'apple', label: 'iPhone' }, { id: 'samsung', label: 'Galaxy' }] as const;
const gbp = (p: number) => `£${(p / 100).toFixed(2)}`;

export default function PhoneCaseDesignPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addToCart } = useHybridCart();
  const { toast } = useToast();
  const [data, setData] = useState<{ design: PublicCaseDesign; models: PublicPhoneModel[]; groups: PhoneLayoutGroup[] } | null>(null);
  const [info, setInfo] = useState<DesignInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [brand, setBrand] = useState<'apple' | 'samsung'>('apple');
  const [modelId, setModelId] = useState<string>('');
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(null);
  const [kitName, setKitName] = useState('');
  const [kitNumber, setKitNumber] = useState('');
  const [painting, setPainting] = useState<number | null>(null);
  const [result, setResult] = useState<Custom | null>(null);
  const [composites, setComposites] = useState<Record<string, string>>({});
  const [fitting, setFitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'basket' | 'checkout' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    fetch(`/api/public/phone-cases?design=${id}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('This phone case isn’t available'))))
      .then(d => {
        setData({ design: d.designs[0], models: d.models, groups: d.groups });
        const first = d.models.find((m: PublicPhoneModel) => d.designs[0].art[m.group] && m.product);
        if (first) { setModelId(first.id); setBrand(first.brand); }
      })
      .catch(e => setLoadError(e.message));
    fetch(`/api/public/catalog-images/${id}`).then(r => (r.ok ? r.json() : null)).then((d: DesignInfo | null) => {
      setInfo(d);
      if (d?.kit) setKitNumber(d.kit.number == null ? '' : String(d.kit.number));
    }).catch(() => {});
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, [id]);

  useEffect(() => {
    if (!painting) return;
    const t = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, [painting]);

  const available = useMemo(() => (data ? data.models.filter(m => data.design.art[m.group] && m.product) : []), [data]);
  const model = available.find(m => m.id === modelId) || null;
  const group = model ? data!.groups.find(g => g.id === model.group) : null;
  const art = model ? data!.design.art[model.group] : null;

  // Their own pet: the case for this phone's camera layout (made once per layout, then cached)
  useEffect(() => {
    if (!result || !model || composites[model.group] || fitting === model.group) return;
    const g = model.group;
    setFitting(g); setError(null);
    fetch('/api/phone-cases/composite', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customImageId: result.id, group: g }) })
      .then(r => r.json().then(d => (r.ok ? d : Promise.reject(new Error(d.error || 'Could not fit it to your phone')))))
      .then(async d => { await preload(d.url); setComposites(c => ({ ...c, [g]: d.url })); })
      .catch(e => setError(e.message))
      .finally(() => setFitting(f => (f === g ? null : f)));
  }, [result, model, composites, fitting]);

  async function choosePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0];
    e.target.value = '';
    if (!raw) return;
    setError(null);
    const file = await preparePetPhoto(raw);
    if (file.size > 12 * 1024 * 1024) { setError('Please pick a smaller photo (under 12MB).'); return; }
    setPhoto({ file, preview: URL.createObjectURL(file) });
  }

  const hasKit = !!info?.kit;
  const nameOk = !hasKit || !!cleanKitName(kitName);
  const ready = !!photo && nameOk && !!model;

  async function paint() {
    if (!data || !photo || !ready) return;
    setError(null);
    const started = Date.now();
    setPainting(started);
    try {
      const fd = new FormData();
      fd.append('catalogImageId', data.design.id);
      fd.append('source', 'phone-cases');
      fd.append('petPhoto', photo.file);
      if (hasKit) { fd.append('kitName', kitName.trim().toUpperCase()); fd.append('kitNumber', kitNumber); }
      const res = await fetch('/api/customers/custom-images/generate', { method: 'POST', credentials: 'include', body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.id) throw new Error(d.error || 'Pawcasso dropped his brush. Please try again.');
      const done = await new Promise<Custom>((resolve, reject) => {
        const check = async () => {
          try {
            const r = await fetch(`/api/customers/custom-images/${d.id}`, { credentials: 'include', cache: 'no-store' });
            if (r.ok) {
              const c: Custom = await r.json();
              if (c.status === 'complete') { resolve(c); return; }
              if (c.status === 'failed') { reject(new Error('Pawcasso couldn’t paint that one. Try a clearer photo of your pet, face in view.')); return; }
            }
          } catch { /* keep polling */ }
          if (Date.now() - started > POLL_TIMEOUT_MS) { reject(new Error('That’s taking longer than usual. Please try again.')); return; }
          pollRef.current = setTimeout(check, POLL_MS);
        };
        pollRef.current = setTimeout(check, POLL_MS);
      });
      setComposites({});
      setResult(done);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPainting(null);
    }
  }

  if (loadError) {
    return (
      <Shell>
        <main className="mx-auto max-w-xl px-4 py-12 text-center">
          <p className="text-gray-700">{loadError}</p>
          <Link href="/phone-cases" className="mt-4 inline-block text-purple-700 underline">See all phone cases</Link>
        </main>
      </Shell>
    );
  }
  if (!data) return <Shell><p className="py-16 text-center text-gray-500">Loading…</p></Shell>;

  const name = data.design.title;
  const about = plainText((info?.description || '').replace(/\*\*(.+?)\*\*/, '').trim());
  const petName = result?.pet_name && result.pet_name !== 'Uploaded Pet' ? result.pet_name : null;
  const previewUrl = result && model ? composites[model.group] : art?.url;
  const product = model?.product || null;
  const elapsed = painting ? Math.floor((Date.now() - painting) / 1000) : 0;
  const brandModels = available.filter(m => m.brand === brand);
  const title = `${petName ? `${petName}’s` : result ? 'Your' : ''} ${name} phone case${model ? ` · ${model.name}` : ''}`.trim();

  async function buy(then: 'basket' | 'checkout') {
    if (!product || !model || !previewUrl) return;
    setBusy(then);
    try {
      await addToCart({
        productId: product.id, imageId: result ? result.id : data!.design.id, imageUrl: previewUrl, imageTitle: title,
        product: { id: product.id, name: product.name, sku: product.sku, product_type: 'physical_print', requires_shipping: true, gelato_sku: product.gelato_sku, size_name: model.name, shape_family: 'phone' } as any,
        pricing: { sale_price: product.price_pence, country_code: 'GB', currency_code: 'GBP', currency_symbol: '£', is_current: true } as any,
        quantity: 1, gelatoProductUid: product.gelato_sku ?? undefined,
        printSpecs: { width_cm: model.case_w_mm / 10, height_cm: model.case_h_mm / 10, medium: 'Phone Case', format: model.name },
      } as any);
      track.addToCart([{ id: data!.design.id, name: title, variant: `phone_case_${model.id}`, price: product.price_pence / 100 }]);
      if (then === 'checkout') router.push('/shop/checkout');
      else toast({ title: 'Added to your basket 🛍️', description: 'Keep browsing — your basket is in the top bar.' });
    } catch (e: any) {
      setError(e?.message || 'Could not add it to your basket');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Shell>
      <main className="mx-auto max-w-5xl px-4 py-6 pb-28 md:pb-10">
        <Link href="/phone-cases" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-purple-700"><ArrowLeft className="h-4 w-4" /> All phone cases</Link>

        <div className="mt-4 grid gap-8 md:grid-cols-2">
          <div className="flex flex-col items-center">
            <div className="relative flex w-full justify-center rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
              {model && group && art && (
                <CasePreview url={previewUrl || art.url} layout={art.layout} model={model} camera={group.camera} className={`h-[28rem] w-auto max-w-full sm:h-[32rem] ${result && !previewUrl ? 'opacity-40' : ''}`} label={title} />
              )}
              {result && !previewUrl && (
                <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm font-medium text-gray-700"><Loader2 className="h-5 w-5 animate-spin" />Fitting it to your {model?.name}…</div>
              )}
            </div>
            <p className="mt-2 text-center text-sm text-gray-600">{result ? `Your pet on the ${model?.name ?? 'phone'} case` : 'Shown with the design’s own pet. Add a photo to paint yours in.'}</p>
          </div>

          <div>
            <h1 className="text-4xl text-gray-900" style={lifeSavers}>{name}</h1>
            <p className="font-semibold text-gray-800">Slim glossy phone case{product ? ` · ${gbp(product.price_pence)}` : ''}</p>
            {about && <p className="mt-2 line-clamp-4 text-gray-700">{about}</p>}

            <div className="mt-6 space-y-5">
              <div className={painting ? 'pointer-events-none opacity-60' : ''}>
                <p className="text-sm font-semibold text-gray-900">1. Your phone</p>
                <div className="mt-2 inline-flex rounded-xl bg-gray-100 p-1" role="group" aria-label="Phone brand">
                  {BRANDS.map(b => (
                    <button key={b.id} type="button" aria-pressed={brand === b.id}
                      onClick={() => { setBrand(b.id); const first = available.find(m => m.brand === b.id); if (first) setModelId(first.id); }}
                      className={`rounded-lg px-4 py-1.5 text-sm font-medium ${brand === b.id ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-600'}`}>{b.label}</button>
                  ))}
                </div>
                <select value={modelId} onChange={e => setModelId(e.target.value)} aria-label={`${brand === 'apple' ? 'iPhone' : 'Galaxy'} model`}
                  className="mt-2 block h-12 w-full rounded-xl border border-gray-300 bg-white px-3 text-base">
                  {brandModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>

              {!result && (
                <>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">2. A photo of your pet</p>
                    <input ref={fileRef} type="file" accept="image/*,.heic,.heif" className="hidden" onChange={choosePhoto} />
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={!!painting}
                      className="mt-2 flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-purple-200 bg-white p-3 text-left hover:border-purple-400 disabled:opacity-60">
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
                      <p className="text-sm font-semibold text-gray-900">3. Their name and number on the shirt</p>
                      <div className="mt-2 flex gap-3">
                        <input value={kitName} onChange={e => setKitName(e.target.value.toUpperCase().replace(/[^A-Z '‘’\-]/g, '').slice(0, 12))}
                          placeholder="BISCUIT" aria-label="Name on the shirt" autoCapitalize="characters" autoComplete="off" maxLength={12} disabled={!!painting}
                          className="h-12 min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-4 text-lg font-semibold uppercase tracking-wide placeholder:font-normal placeholder:text-gray-400" />
                        <input value={kitNumber} onChange={e => setKitNumber(e.target.value.replace(/\D/g, '').slice(0, 2))}
                          placeholder="–" aria-label="Number on the shirt" inputMode="numeric" maxLength={2} disabled={!!painting}
                          className="h-12 w-20 rounded-xl border border-gray-300 bg-white px-3 text-center text-lg font-semibold" />
                      </div>
                      {kitName.trim() && !nameOk && <p role="alert" className="mt-1 text-sm text-red-700">Letters only please, and nothing rude.</p>}
                    </div>
                  )}

                  {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

                  <button type="button" onClick={paint} disabled={!ready || !!painting}
                    className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-purple-600 text-lg font-semibold text-white shadow-lg disabled:opacity-50">
                    {painting
                      ? <><Loader2 className="h-5 w-5 animate-spin" /> {PAINTING_LINES[Math.min(Math.floor(elapsed / 12), PAINTING_LINES.length - 1)]} {elapsed}s</>
                      : <><Sparkles className="h-5 w-5" /> {!photo ? 'Add a photo to continue' : !nameOk ? 'Add their name for the shirt' : 'Paint my case'}</>}
                  </button>
                  {painting && <p className="text-center text-xs text-gray-500">Usually under a minute. Keep this page open.</p>}
                  {!painting && product && (
                    <p className="text-center text-sm text-gray-600">
                      or <button type="button" onClick={() => buy('basket')} disabled={!product.on_sale || !!busy} className="font-medium text-purple-700 underline disabled:no-underline disabled:opacity-60">buy this design as shown</button>
                    </p>
                  )}
                </>
              )}

              {result && (
                <div className="space-y-3">
                  {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                  {product?.on_sale ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button type="button" onClick={() => buy('checkout')} disabled={!previewUrl || !!busy}
                        className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-purple-600 text-lg font-semibold text-white shadow-lg disabled:opacity-50">
                        {busy === 'checkout' ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Buy now · {gbp(product.price_pence)}</>}
                      </button>
                      <button type="button" onClick={() => buy('basket')} disabled={!previewUrl || !!busy}
                        className="flex h-14 items-center justify-center gap-2 rounded-2xl border-2 border-purple-600 text-lg font-semibold text-purple-700 disabled:opacity-50">
                        {busy === 'basket' ? <Loader2 className="h-5 w-5 animate-spin" /> : <><ShoppingBag className="h-5 w-5" /> Add to basket</>}
                      </button>
                    </div>
                  ) : (
                    <p className="rounded-xl bg-purple-50 p-3 text-sm text-purple-900">Phone cases go on sale very soon. Your picture is saved in your gallery.</p>
                  )}
                  <p className="text-xs text-gray-500">Printed edge to edge and posted to you · switch phone above to see it on another model</p>
                  <BasketBar />
                  <button type="button" onClick={() => { setResult(null); setPhoto(null); setComposites({}); setError(null); }} className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-purple-700">
                    <RotateCcw className="h-4 w-4" /> Start again with another photo
                  </button>
                </div>
              )}
            </div>
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
