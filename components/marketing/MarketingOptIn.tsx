'use client';

/**
 * The marketing opt-in tick box. Controlled, never pre-ticked, wording from lib/marketing/consent-copy.ts.
 * Not ticking means no marketing email. Order emails, receipts and download links are never affected.
 */
import { useId } from 'react';
import { CONSENT_LABEL } from '@/lib/marketing/consent-copy';

export default function MarketingOptIn({ checked, onChange, className = '' }: { checked: boolean; onChange: (checked: boolean) => void; className?: string }) {
  const id = useId();
  return (
    <label htmlFor={id} className={`flex min-h-[44px] cursor-pointer items-start gap-3 py-2 text-sm text-gray-700 ${className}`}>
      <input id={id} type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-0.5 h-6 w-6 shrink-0 accent-purple-600" />
      <span>{CONSENT_LABEL}</span>
    </label>
  );
}
