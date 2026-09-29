'use client';

import { useState } from 'react';
import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { Lock } from 'lucide-react';

export default function StallPayForm({ amountLabel, onPaid }: { amountLabel: string; onPaid: (piId: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true); setError(null);
    const { error: err, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/stall/paid` },
      redirect: 'if_required',
    });
    if (err) {
      setError(err.message || 'Payment didn’t go through — please try again.');
      setBusy(false);
      return;
    }
    if (paymentIntent) onPaid(paymentIntent.id);
  }

  return (
    <form onSubmit={pay} className="space-y-4">
      <PaymentElement
        onReady={() => setReady(true)}
        options={{ layout: { type: 'tabs', defaultCollapsed: false }, wallets: { applePay: 'auto', googlePay: 'auto' }, fields: { billingDetails: { address: 'if_required' } } }}
      />
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={!stripe || !ready || busy}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-purple-600 text-lg font-semibold text-white shadow-lg disabled:bg-purple-300">
        <Lock className="h-4 w-4" /> {busy ? 'Paying…' : `Pay ${amountLabel}`}
      </button>
    </form>
  );
}
