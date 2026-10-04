'use client';

/**
 * One quiz statement as a swipeable card. Drag right = "Totally Daisy!", left = "Not Daisy"
 * ("my pet" when no name was given).
 * The parent also offers buttons and arrow keys, so swiping is never required.
 * Pointer events (mouse, touch, pen); the card flies off, then onAnswer fires.
 */
import { useEffect, useRef, useState } from 'react';
import { Compass, GraduationCap, PawPrint, Users, Zap } from 'lucide-react';
import type { Dimension, Swipe } from '@/lib/quiz/types';

const THRESHOLD = 90;      // px of drag that counts as an answer
const FLY_MS = 260;

const DIM_ICON: Record<Dimension, typeof Zap> = { EI: Zap, SN: Users, TF: GraduationCap, BC: Compass };

export interface SwipeCardHandle { fling: (swipe: Swipe) => void }

export default function SwipeCard({
  lead, statement, imageUrl, dimension, onAnswer, flingRef, disabled, onLean, petLabel = 'my pet',
}: {
  /** e.g. "BISCUIT ALWAYS…" */
  lead: string;
  /** The rest of the statement */
  statement: string;
  imageUrl?: string | null;
  dimension: Dimension;
  onAnswer: (swipe: Swipe) => void;
  /** Lets the parent's buttons and keys trigger the same fly-off animation */
  flingRef?: React.MutableRefObject<SwipeCardHandle | null>;
  disabled?: boolean;
  /** How far the card leans while dragged or flying: -1 (fully "no") … 0 … 1 (fully "yes") */
  onLean?: (lean: number) => void;
  /** The pet's name for the stamps ("TOTALLY DAISY!"), else "my pet" */
  petLabel?: string;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [flying, setFlying] = useState<Swipe | null>(null);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const answered = useRef(false);

  const fling = (swipe: Swipe) => {
    if (answered.current || disabled) return;
    answered.current = true;
    setFlying(swipe);
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) { try { navigator.vibrate?.(12); } catch { /* not supported */ } }
    window.setTimeout(() => onAnswer(swipe), FLY_MS);
  };

  useEffect(() => {
    if (flingRef) flingRef.current = { fling };
    return () => { if (flingRef) flingRef.current = null; };
  });

  function onPointerDown(e: React.PointerEvent) {
    if (disabled || answered.current) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!start.current || start.current.id !== e.pointerId) return;
    setDx(e.clientX - start.current.x);
  }
  function onPointerUp(e: React.PointerEvent) {
    if (!start.current || start.current.id !== e.pointerId) return;
    start.current = null;
    setDragging(false);
    if (dx > THRESHOLD) fling('right');
    else if (dx < -THRESHOLD) fling('left');
    else setDx(0);
  }

  const x = flying === 'right' ? 520 : flying === 'left' ? -520 : dx;
  const rotate = Math.max(-18, Math.min(18, x / 18));
  const yes = Math.min(1, Math.max(0, x / THRESHOLD));
  const no = Math.min(1, Math.max(0, -x / THRESHOLD));
  const Icon = DIM_ICON[dimension];
  const lean = Math.max(-1, Math.min(1, x / THRESHOLD));
  useEffect(() => { onLean?.(lean); }, [lean]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="absolute inset-0 select-none touch-pan-y"
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
      style={{
        transform: `translateX(${x}px) rotate(${rotate}deg)`,
        transition: dragging ? 'none' : `transform ${FLY_MS}ms ease-out, opacity ${FLY_MS}ms ease-out`,
        opacity: flying ? 0 : 1,
        cursor: dragging ? 'grabbing' : 'grab',
      }}
    >
      <div className="relative flex h-full flex-col overflow-hidden rounded-[22px] border border-purple-100 bg-white shadow-[0_12px_32px_-14px_rgba(29,24,40,0.35)]">
        <div className="relative h-[56%] shrink-0 bg-purple-50">
          {imageUrl ? (
            <img src={imageUrl} alt="" draggable={false} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[repeating-linear-gradient(135deg,#efe9f8_0_14px,#f6f2fc_14px_28px)]" aria-hidden="true">
              <span className="relative flex h-24 w-24 items-center justify-center rounded-full bg-white/80">
                <PawPrint className="h-12 w-12 text-purple-300" />
                <span className="absolute -right-1 -top-1 flex h-9 w-9 items-center justify-center rounded-full bg-purple-600 text-white"><Icon className="h-5 w-5" /></span>
              </span>
            </div>
          )}
          <span className="absolute left-4 top-4 max-w-[75%] truncate rounded-lg border-[2.5px] border-green-700 bg-white px-3 py-1 text-sm font-extrabold tracking-wide text-green-700"
            style={{ opacity: yes, transform: 'rotate(-8deg)' }} aria-hidden="true">TOTALLY {petLabel.toUpperCase()}!</span>
          <span className="absolute right-4 top-4 max-w-[75%] truncate rounded-lg border-[2.5px] border-gray-700 bg-white px-3 py-1 text-sm font-extrabold tracking-wide text-gray-700"
            style={{ opacity: no, transform: 'rotate(8deg)' }} aria-hidden="true">NOT {petLabel.toUpperCase()}</span>
        </div>
        <div className="flex flex-1 flex-col justify-center gap-1.5 px-5 py-4">
          <p className="text-sm font-bold uppercase tracking-wide text-purple-700">{lead}</p>
          <p className="text-[1.35rem] font-semibold leading-snug text-gray-900">{statement}</p>
        </div>
      </div>
    </div>
  );
}
