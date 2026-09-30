'use client';

import { ALLOWED_ASPECT_RATIOS, isAllowedAspectRatio } from '@/lib/print/print-geometry';

const LABELS: Record<string, string> = {
  '1:1': '1:1 — Square',
  '2:3': '2:3 — Portrait (prints S, M, L)',
  '3:2': '3:2 — Landscape (prints S, M, L)',
  '2:1': '2:1 — Wide (mugs)',
};

/** Aspect ratio picker limited to the four allowed reference shapes. */
export default function AspectRatioSelect({ id = 'aspect_ratio', value, onChange, className }: {
  id?: string; value: string; onChange: (value: string) => void; className?: string;
}) {
  const legacy = value && !isAllowedAspectRatio(value);
  return (
    <div className="space-y-1">
      <select
        id={id}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        required
        className={className || 'w-full h-10 px-3 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500'}
      >
        <option value="" disabled>Choose…</option>
        {legacy && <option value={value}>{value} (no longer allowed)</option>}
        {ALLOWED_ASPECT_RATIOS.map(r => <option key={r} value={r}>{LABELS[r]}</option>)}
      </select>
      {legacy && (
        <p className="text-xs text-amber-700">
          {value} isn’t one of the allowed shapes. Choose 1:1, 2:3, 3:2 or 2:1 — or deactivate this format.
        </p>
      )}
    </div>
  );
}
