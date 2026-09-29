'use client';

/**
 * "PAID" screen the customer shows the stallholder. Verified against Stripe on load; a live
 * ticking clock and moving pattern make an old screenshot easy to spot.
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { track } from '@/lib/tracking/events';

interface Receipt {
  paid: boolean; status: string; amountPence: number; paidAt: number; firstName: string;
  takeHome: Array<{ title: string; size: 'S' | 'M' | 'L' | null; stockRef: number | null; imageUrl: string | null }>;
  deliveredCount: number; stallName: string | null; orderNumber: string | null; last4: string;
}
const SIZE: Record<string, string> = { S: 'Small', M: 'Medium', L: 'Large' };

export default function StallPaidPage() {
  const [pi, setPi] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [now, setNow] = useState(new Date());
  const [error, setError] = useState<string | null>(null);
  const tracked = useRef(false);

  useEffect(() => { setPi(new URLSearchParams(window.location.search).get('payment_intent')); }, []);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  useEffect(() => {
    if (!pi) return;
    let stop = false;
    const load = async () => {
      const r = await fetch(`/api/stall/receipt?pi=${encodeURIComponent(pi)}`, { cache: 'no-store' });
      if (!r.ok) { setError('We couldn’t find this payment.'); return; }
      const d: Receipt = await r.json();
      setReceipt(d);
      if (d.paid && !tracked.current) {
        tracked.current = true;
        track.purchase(d.orderNumber || pi, pi, d.amountPence / 100, d.takeHome.map(t => ({ id: String(t.stockRef ?? ''), name: t.title, variant: `stall_${t.size}` })));
      }
      if (!stop && (!d.paid || !d.orderNumber)) setTimeout(load, 2500);
    };
    load();
    return () => { stop = true; };
  }, [pi]);

  if (error) return <main className="min-h-[100dvh] px-6 py-16 text-center text-gray-700">{error}</main>;
  if (!receipt) return <main className="min-h-[100dvh] flex items-center justify-center text-gray-500">Checking payment…</main>;

  if (!receipt.paid) {
    return (
      <main className="min-h-[100dvh] flex flex-col items-center justify-center bg-amber-50 px-6 text-center">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-amber-200 border-t-amber-600" />
        <p className="mt-6 text-xl font-semibold text-amber-900">Payment {receipt.status === 'processing' ? 'processing' : 'not complete'}…</p>
        <p className="mt-2 text-amber-800">Please wait — this screen updates by itself.</p>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] overflow-hidden bg-green-600 text-white">
      <style>{`@keyframes pt-slide{from{background-position:0 0}to{background-position:80px 80px}}`}</style>
      <div className="absolute inset-0 opacity-15" style={{ backgroundImage: 'repeating-linear-gradient(45deg,#fff 0 10px,transparent 10px 40px)', animation: 'pt-slide 3s linear infinite' }} aria-hidden />
      <div className="relative mx-auto flex min-h-[100dvh] max-w-md flex-col items-center px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-10 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white text-5xl text-green-600 shadow-xl">✓</div>
        <h1 className="mt-5 text-4xl font-extrabold tracking-tight">PAID</h1>
        <p className="mt-1 text-lg">£{(receipt.amountPence / 100).toFixed(2)} · {receipt.takeHome.length} print{receipt.takeHome.length === 1 ? '' : 's'} to take home</p>
        <p className="mt-3 font-mono text-3xl tabular-nums">{now.toLocaleTimeString('en-GB')}</p>
        <p className="text-sm opacity-90">{now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>

        <div className="mt-6 w-full space-y-2">
          {receipt.takeHome.map((t, i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl bg-white/15 p-3 text-left">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {t.imageUrl && <img src={t.imageUrl} alt="" className="h-16 w-12 rounded-lg object-cover" />}
              <div className="text-sm">
                <p className="font-semibold">Ref {t.stockRef ?? '—'}-{t.size} · {t.size ? SIZE[t.size] : ''}</p>
                <p className="opacity-90 line-clamp-1">{t.title}</p>
              </div>
            </div>
          ))}
          <div className="flex justify-between rounded-2xl bg-white/10 px-3 py-2 text-left text-sm">
            <span>{receipt.orderNumber ? `Order ${receipt.orderNumber}` : `Payment …${receipt.last4}`}</span>
            {receipt.stallName && <span className="opacity-90">{receipt.stallName}</span>}
          </div>
          {receipt.deliveredCount > 0 && (
            <p className="rounded-2xl bg-white/10 px-3 py-2 text-left text-sm">
              + {receipt.deliveredCount} more item{receipt.deliveredCount === 1 ? '' : 's'} on {receipt.deliveredCount === 1 ? 'its' : 'their'} way to you (prints are delivered, downloads are emailed)
            </p>
          )}
        </div>

        <p className="mt-6 rounded-xl bg-white px-4 py-3 text-lg font-bold text-green-700">Show this screen to the stallholder 👋</p>

        <div className="mt-auto pt-8 text-sm opacity-95">
          <p>Thanks {receipt.firstName || 'so much'}! Your receipt is on its way by email, with a link to your <strong>free digital copy</strong>.</p>
          <Link href="/browse" className="mt-4 inline-block underline">Put your own pet in a portrait →</Link>
        </div>
      </div>
    </main>
  );
}
