'use client';

/**
 * Checkout, for people buying from us: one line of text and an UNTICKED "No thanks" box. Leaving it
 * unticked means they are subscribed once the order is paid (lib/marketing/preferences.ts
 * subscribeFromPurchase). Wording: lib/marketing/consent-copy.ts. Order emails are never affected.
 */
import { useId } from 'react';
import { CHECKOUT_LINE, CHECKOUT_OPT_OUT_LABEL } from '@/lib/marketing/consent-copy';

export default function MarketingOptOut({ checked, onChange, className = '' }: { checked: boolean; onChange: (checked: boolean) => void; className?: string }) {
  const id = useId();
  return (
    <div className={`pt-1 text-sm text-gray-700 ${className}`}>
      <p>{CHECKOUT_LINE}</p>
      <label htmlFor={id} className="flex min-h-[44px] cursor-pointer items-start gap-3 py-2">
        <input id={id} type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-0.5 h-6 w-6 shrink-0 accent-purple-600" />
        <span>{CHECKOUT_OPT_OUT_LABEL}</span>
      </label>
    </div>
  );
}
