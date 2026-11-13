'use client';

/**
 * "With frame" / "Without frame" for a zodiac sign or tarot card (framed cards, lib/frames/).
 *   FrameToggle    the two-button control (aria-pressed); the page decides what it changes
 *   FrameSwitch    for a finished portrait: switches it without a new generation (POST /api/customers/custom-images/[id]/frame)
 */
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cleanPetName } from '@/lib/picture-words';

export function FrameToggle({ value, onChange, disabled, label = 'Frame' }: { value: 'on' | 'off'; onChange: (v: 'on' | 'off') => void; disabled?: boolean; label?: string }) {
  const btn = (v: 'on' | 'off', text: string) => (
    <button type="button" aria-pressed={value === v} disabled={disabled} onClick={() => value !== v && onChange(v)}
      className={`h-11 flex-1 rounded-lg px-3 text-sm font-semibold transition disabled:opacity-60 ${value === v ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-800 hover:bg-purple-100'}`}>
      {text}
    </button>
  );
  return (
    <div role="group" aria-label={label} className="flex gap-1 rounded-xl border border-purple-200 bg-white p-1">
      {btn('on', 'With frame')}{btn('off', 'Without frame')}
    </div>
  );
}

export interface FrameChoiceInfo { state: 'on' | 'off'; petName: string | null; nameMax: number }

export function FrameSwitch({ imageId, choice, onChanged }: { imageId: string; choice: FrameChoiceInfo; onChanged: () => void | Promise<void> }) {
  const [name, setName] = useState(choice.petName ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameOk = !name.trim() || !!cleanPetName(name);

  async function send(frame: 'on' | 'off') {
    if (frame === 'on' && !nameOk) return;
    setBusy(true); setError(null);
    try {
      const r = await fetch(`/api/customers/custom-images/${imageId}/frame`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(frame === 'on' ? { frame, petName: name.trim() || undefined } : { frame }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setError(d.error || 'Could not change the card just now. Please try again.');
      else await onChanged();
    } catch {
      setError('Could not change the card just now. Please try again.');
    }
    setBusy(false);
  }

  return (
    <section className="mt-4 rounded-2xl border border-purple-200 bg-purple-50/50 p-4" aria-label="Card frame">
      <p className="font-semibold text-gray-900">Your card</p>
      <p className="mb-2 text-sm text-gray-600">{choice.state === 'on' ? 'Shown with its frame. Framed cards are sold as prints only.' : 'Shown without the frame, like any other portrait.'}</p>
      <FrameToggle value={choice.state} disabled={busy} onChange={send} />
      {choice.state === 'on' && (
        <div className="mt-3">
          <label className="block text-sm font-medium text-gray-900" htmlFor="frame-switch-name">Pet&apos;s name on the card</label>
          <div className="mt-1 flex gap-2">
            <input id="frame-switch-name" value={name} onChange={e => setName(e.target.value.slice(0, choice.nameMax))} maxLength={choice.nameMax} placeholder="Optional"
              className="h-11 min-w-0 flex-1 rounded-xl border border-gray-300 px-3 text-base text-gray-900" />
            <button type="button" disabled={busy || !nameOk || name.trim() === (choice.petName ?? '')} onClick={() => send('on')}
              className="h-11 rounded-xl border border-purple-300 px-4 text-sm font-semibold text-purple-800 disabled:opacity-40">Update</button>
          </div>
          {!nameOk && <p role="alert" className="mt-1 text-sm text-red-700">Letters only please (spaces, hyphens and apostrophes are fine), and nothing rude.</p>}
        </div>
      )}
      {choice.state === 'off' && (
        <div className="mt-3">
          <label className="block text-sm font-medium text-gray-900" htmlFor="frame-switch-name-on">Pet&apos;s name on the card (if you add the frame)</label>
          <input id="frame-switch-name-on" value={name} onChange={e => setName(e.target.value.slice(0, choice.nameMax))} maxLength={choice.nameMax} placeholder="Optional"
            className="mt-1 h-11 w-full rounded-xl border border-gray-300 px-3 text-base text-gray-900" />
          {!nameOk && <p role="alert" className="mt-1 text-sm text-red-700">Letters only please (spaces, hyphens and apostrophes are fine), and nothing rude.</p>}
        </div>
      )}
      {busy && <p role="status" className="mt-2 flex items-center gap-1 text-sm text-gray-700"><Loader2 className="h-4 w-4 animate-spin" /> {choice.state === 'on' ? 'Updating your card…' : 'Drawing the frame…'}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </section>
  );
}
