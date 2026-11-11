'use client';

/**
 * A phone case as the customer will get it: the case art cut to this model's case, with Gelato's
 * camera cut-out drawn on (the shape measured from Gelato's design studio). Pure SVG, to scale.
 */
import { cameraOnCanvas, modelOnCanvas, type CameraBox, type CaseArtLayout } from '@/lib/phone-cases/geometry';

export interface PreviewModel { id: string; name: string; case_w_mm: number; case_h_mm: number }

export default function CasePreview({ url, layout, model, camera, className = '', label }: {
  url: string; layout: CaseArtLayout; model: PreviewModel; camera: CameraBox[]; className?: string; label?: string;
}) {
  const { case: c } = modelOnCanvas(layout, model);
  const cams = cameraOnCanvas(layout, model, camera);
  const r = c.w * 0.13, pad = c.w * 0.04;
  const clip = `case-clip-${model.id}`;
  return (
    <svg viewBox={`${c.x - pad} ${c.y - pad} ${c.w + 2 * pad} ${c.h + 2 * pad}`} className={className} role="img" aria-label={label || `Phone case for ${model.name}`}>
      <defs>
        <clipPath id={clip}><rect x={c.x} y={c.y} width={c.w} height={c.h} rx={r} /></clipPath>
        <filter id={`${clip}-shadow`} x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy={c.w * 0.012} stdDeviation={c.w * 0.018} floodOpacity="0.25" /></filter>
      </defs>
      <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={r} fill="#fff" filter={`url(#${clip}-shadow)`} />
      <g clipPath={`url(#${clip})`}>
        <image href={url} x={0} y={0} width={layout.cw} height={layout.ch} preserveAspectRatio="none" />
        {cams.map((b, i) => (
          <g key={i}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={b.r} fill="#1f2937" />
            <rect x={b.x + b.w * 0.04} y={b.y + b.h * 0.04} width={b.w * 0.92} height={b.h * 0.92} rx={b.r * 0.9} fill="none" stroke="#4b5563" strokeWidth={c.w * 0.006} />
          </g>
        ))}
        <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={r} fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth={c.w * 0.012} />
      </g>
      <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={r} fill="none" stroke="#111827" strokeOpacity="0.25" strokeWidth={c.w * 0.004} />
    </svg>
  );
}
