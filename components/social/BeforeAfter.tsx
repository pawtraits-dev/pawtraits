'use client';

/**
 * Before/after reveal: the customer's photo underneath, the Pawtrait on top, with a divider.
 * Mouse: the divider follows the pointer. Touch/pen: drag anywhere on the picture (vertical
 * scrolling still works). Keyboard: focus the handle and use the arrow keys, Home/End.
 */
import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function BeforeAfter({ before, after, label }: { before: string; after: string; label: string }) {
  const [pos, setPos] = useState(50); // % of width showing the "before" photo from the left
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const fromEvent = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r || !r.width) return;
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  };

  return (
    <div ref={box} className="relative aspect-[4/5] w-full select-none overflow-hidden rounded-2xl bg-gray-100"
      style={{ touchAction: 'pan-y' }}
      onPointerMove={e => { if (e.pointerType === 'mouse' || dragging.current) fromEvent(e.clientX); }}
      onPointerDown={e => { if (e.pointerType !== 'mouse') { dragging.current = true; fromEvent(e.clientX); } }}
      onPointerUp={() => { dragging.current = false; }}
      onPointerCancel={() => { dragging.current = false; }}
      onPointerLeave={e => { if (e.pointerType === 'mouse') setPos(50); }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={after} alt={`${label}: the finished Pawtrait`} className="absolute inset-0 h-full w-full object-cover" loading="lazy" draggable={false} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={before} alt={`${label}: the original photo`} className="absolute inset-0 h-full w-full object-cover" loading="lazy" draggable={false}
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />

      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white" style={{ opacity: pos > 12 ? 1 : 0 }}>Before</span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-purple-700/90 px-2.5 py-1 text-xs font-semibold text-white" style={{ opacity: pos < 88 ? 1 : 0 }}>After</span>

      <div className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_6px_rgba(0,0,0,0.4)]" style={{ left: `${pos}%` }} />
      <div role="slider" tabIndex={0} aria-label={`Compare the original photo and the Pawtrait of ${label}`}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pos)} aria-valuetext={`${Math.round(pos)}% original photo`}
        onKeyDown={e => {
          const step = e.shiftKey ? 25 : 10;
          if (e.key === 'ArrowLeft') { e.preventDefault(); setPos(p => Math.max(0, p - step)); }
          else if (e.key === 'ArrowRight') { e.preventDefault(); setPos(p => Math.min(100, p + step)); }
          else if (e.key === 'Home') { e.preventDefault(); setPos(0); }
          else if (e.key === 'End') { e.preventDefault(); setPos(100); }
        }}
        className="absolute top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-purple-800 shadow-lg outline-none focus-visible:ring-4 focus-visible:ring-purple-400"
        style={{ left: `${pos}%` }}>
        <ChevronLeft className="-mr-1 h-4 w-4" aria-hidden="true" /><ChevronRight className="-ml-1 h-4 w-4" aria-hidden="true" />
      </div>
    </div>
  );
}
