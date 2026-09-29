'use client';

/**
 * Stall "take this print home now": the customer pays on their own phone instead of the
 * card reader / cash, so we get their details, an order record and an account.
 */
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Elements } from '@stripe/react-stripe-js';
import { ArrowLeft, Gift } from 'lucide-react';
import { getStripe } from '@/lib/stripe-client';
import StallPayForm from '@/components/stall/StallPayForm';
import { track } from '@/lib/tracking/events';

interface Offer {
  available: boolean; reason?: string; locationName?: string; size?: 'S' | 'M' | 'L';
  pricePence?: number; listPricePence?: number; discountPct?: number; prices?: Record<'S' | 'M' | 'L', number>;
}
const SIZE_LABEL = { S: 'Small', M: 'Medium', L: 'Large' } as const;
const gbp = (p?: number) => (p === undefined ? '' : `£${(p / 100).toFixed(p % 100 === 0 ? 0 : 2)}`);

export default function StallBuyPage() {
  const { imageId } = useParams() as { imageId: string };
  const router = useRouter();
  const stripePromise = useMemo(() => getStripe(), []);

  const [image, setImage] = useState<{ description: string; imageUrl: string } | null>(null);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [size, setSize] = useState<'S' | 'M' | 'L' | null>(null);
  const [sizeFixed, setSizeFixed] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', marketingOptIn: false });
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const qsSize = new URLSearchParams(window.location.search).get('size')?.toUpperCase();
    fetch(`/api/public/catalog-images/${imageId}`).then(r => r.json()).then(setImage).catch(() => {});
    fetch(`/api/stall/offer?imageId=${imageId}${qsSize ? `&size=${qsSize}` : ''}`, { credentials: 'include' })
      .then(r => r.json())
      .then((o: Offer) => {
        setOffer(o);
        if (o.size) setSize(o.size);
        let scanned: string | null = null;
        try { scanned = sessionStorage.getItem('pt_qr_size'); } catch { /* ignore */ }
        setSizeFixed(!!(qsSize || scanned)); // the physical print in their hand has a size
      })
      .catch(() => setOffer({ available: false }));
  }, [imageId]);

  const price = offer?.prices && size
    ? Math.round(offer.prices[size] * (1 - (offer.discountPct || 0) / 100))
    : offer?.pricePence;

  async function continueToPay(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const res = await fetch('/api/stall/checkout', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageId, size, ...form }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error); return; }
    setClientSecret(data.clientSecret);
    setAmount(data.amount);
    track.beginCheckout([{ id: imageId, name: image?.description, variant: `stall_${size}`, price: data.amount / 100 }]);
  }

  if (offer && !offer.available) {
    return (
      <main className="min-h-[100dvh] bg-gray-50 px-5 py-16 text-center">
        <p className="text-lg font-semibold text-gray-900">This option is for buying at our stall</p>
        <p className="mt-2 text-gray-600">Scan the QR sticker on the back of the print to buy it on your phone. You can still order this design for delivery.</p>
        <Link href={`/shop/${imageId}`} className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-purple-600 px-6 font-semibold text-white">Order for delivery</Link>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-gray-50">
      <div className="mx-auto max-w-md px-4 pb-10 pt-3">
        <button onClick={() => router.back()} className="inline-flex items-center gap-1 py-2 text-sm text-gray-600"><ArrowLeft className="h-4 w-4" /> Back</button>

        <div className="flex gap-4 rounded-2xl bg-white p-3 shadow-sm">
          <div className="h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {image?.imageUrl && <img src={image.imageUrl} alt="" className="h-full w-full object-cover" />}
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-purple-700">Take it home now</p>
            <p className="font-semibold text-gray-900 line-clamp-2">{image?.description || 'Pawtraits print'}</p>
            <p className="mt-1 text-sm text-gray-600">{size ? `${SIZE_LABEL[size]} print` : ''}{offer?.locationName ? ` · ${offer.locationName}` : ''}</p>
            <p className="mt-1 text-xl font-bold text-gray-900">
              {gbp(price)}
              {offer?.discountPct ? <span className="ml-2 text-sm font-normal text-gray-400 line-through">{gbp(offer.prices && size ? offer.prices[size] : offer.listPricePence)}</span> : null}
            </p>
          </div>
        </div>

        {!sizeFixed && offer?.prices && !clientSecret && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {(['S', 'M', 'L'] as const).map(s => (
              <button key={s} onClick={() => setSize(s)}
                className={`h-16 rounded-xl border-2 text-sm font-semibold ${size === s ? 'border-purple-600 bg-purple-50 text-purple-900' : 'border-gray-200 bg-white text-gray-700'}`}>
                {SIZE_LABEL[s]}<br /><span className="font-normal">{gbp(Math.round(offer.prices![s] * (1 - (offer.discountPct || 0) / 100)))}</span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-start gap-3 rounded-2xl bg-purple-50 p-4 text-sm text-purple-900">
          <Gift className="mt-0.5 h-5 w-5 shrink-0" />
          <p><strong>Free digital copy included.</strong> We’ll email your receipt and a link to download this design in full resolution.</p>
        </div>

        {!clientSecret ? (
          <form onSubmit={continueToPay} className="mt-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">First name</span>
                <input required autoComplete="given-name" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })}
                  className="mt-1 h-12 w-full rounded-xl border border-gray-300 px-3 text-base focus:border-purple-600 focus:outline-none" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Last name</span>
                <input autoComplete="family-name" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })}
                  className="mt-1 h-12 w-full rounded-xl border border-gray-300 px-3 text-base focus:border-purple-600 focus:outline-none" />
              </label>
            </div>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Email for your receipt</span>
              <input required type="email" inputMode="email" autoComplete="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                className="mt-1 h-12 w-full rounded-xl border border-gray-300 px-3 text-base focus:border-purple-600 focus:outline-none" />
            </label>
            <label className="flex items-start gap-3 py-1 text-sm text-gray-700">
              <input type="checkbox" checked={form.marketingOptIn} onChange={e => setForm({ ...form, marketingOptIn: e.target.checked })} className="mt-0.5 h-5 w-5 accent-purple-600" />
              <span>Send me the occasional new design and offer (you can unsubscribe any time)</span>
            </label>
            {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={busy || !size}
              className="h-14 w-full rounded-2xl bg-purple-600 text-lg font-semibold text-white shadow-lg disabled:bg-purple-300">
              {busy ? 'One moment…' : `Continue to pay ${gbp(price)}`}
            </button>
            <p className="text-center text-xs text-gray-500">Apple Pay, Google Pay and cards accepted. We’ll set up a free Pawtraits account with this email so you can find your download.</p>
          </form>
        ) : (
          <div className="mt-5">
            <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe', variables: { colorPrimary: '#9333ea', borderRadius: '12px', fontSizeBase: '16px' } } }}>
              <StallPayForm amountLabel={gbp(amount ?? price)} onPaid={id => router.replace(`/stall/paid?payment_intent=${id}`)} />
            </Elements>
          </div>
        )}
      </div>
    </main>
  );
}
