'use client';

/**
 * Admin → Products → Phone cases: the models we sell (Gelato slim glossy), each drawn to scale with
 * Gelato's camera cut-out (red) and where the 2:3 painting sits by default (gold dashed). The
 * "camera covers" figure is how far the cut-out reaches into the painting's top-left corner: fine
 * when that part of the design is background, which is checked per design when its case art is
 * approved. Data: /api/admin/phone-cases. Plan: claude/phone-cases-plan.md
 */
import { useEffect, useMemo, useState } from 'react';
import { Loader2, Smartphone } from 'lucide-react';
import { cameraOverlap, defaultSlot, type CameraBox, type PhoneLayoutGroup, type PhoneModel } from '@/lib/phone-cases/geometry';

type Row = PhoneModel & { sku: string | null; product_active: boolean; price_pence: number | null; cost_pence: number | null };
const gbp = (p: number | null) => (p == null ? '—' : `£${(p / 100).toFixed(2)}`);

function CaseDrawing({ model, camera }: { model: Row; camera: CameraBox[] }) {
  const W = Number(model.case_w_mm), H = Number(model.case_h_mm);
  const slot = defaultSlot(model);
  const r = Math.min(W, H) * 0.14;
  return (
    <svg viewBox={`-2 -2 ${W + 4} ${H + 4}`} className="h-56 w-auto" role="img" aria-label={`${model.name}: case outline, camera cut-out and painting position`}>
      <rect x={0} y={0} width={W} height={H} rx={r} fill="#fff" stroke="#111827" strokeWidth={0.8} />
      <rect x={slot.x} y={slot.y} width={slot.w} height={slot.h} fill="#F3E8FF" stroke="#C9A44C" strokeWidth={0.8} strokeDasharray="2.5 1.5" />
      {camera.map((b, i) => <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={b.r} fill="#FCA5A5" fillOpacity={0.75} stroke="#DC2626" strokeWidth={0.5} />)}
    </svg>
  );
}

export default function PhoneCasesPage() {
  const [data, setData] = useState<{ groups: PhoneLayoutGroup[]; models: Row[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/phone-cases', { credentials: 'include' }).then(r => r.json()).then(d => (d.error ? setError(d.error) : setData(d))).catch(() => setError('Could not load the phone models'));
  }, []);

  const groups = useMemo(() => Object.fromEntries((data?.groups ?? []).map(g => [g.id, g])), [data]);

  const toggle = async (m: Row) => {
    setBusy(m.id);
    const r = await fetch('/api/admin/phone-cases', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: m.id, is_active: !m.is_active }) });
    setBusy(null);
    if (!r.ok) { setError((await r.json().catch(() => ({}))).error || 'Could not update'); return; }
    setData(d => d && { ...d, models: d.models.map(x => (x.id === m.id ? { ...x, is_active: !m.is_active } : x)) });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold text-gray-900"><Smartphone className="h-7 w-7" />Phone cases</h1>
        <p className="mt-1 max-w-3xl text-gray-600">
          Slim glossy cases printed and posted by Gelato. Each model is drawn to scale: <span className="font-medium text-red-700">red</span> is
          Gelato’s camera cut-out, <span className="font-medium text-amber-700">gold dashed</span> is where the painting sits. Models with
          the same layout letter share one case-art background per design.
        </p>
      </div>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {!data && !error && <p className="flex items-center gap-2 text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />Loading…</p>}
      {data && (['apple', 'samsung'] as const).map(brand => (
        <section key={brand}>
          <h2 className="mb-3 text-xl font-semibold text-gray-900">{brand === 'apple' ? 'iPhone' : 'Galaxy'}</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.models.filter(m => m.brand === brand).map(m => {
              const g = groups[m.layout_group];
              const ov = g ? cameraOverlap(defaultSlot(m), g.camera) : null;
              return (
                <li key={m.id} className={`rounded-xl border bg-white p-4 ${m.is_active ? 'border-gray-200' : 'border-dashed border-gray-300 opacity-60'}`}>
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-gray-900">{m.name}</h3>
                      <p className="text-xs text-gray-500">{Number(m.case_w_mm)} × {Number(m.case_h_mm)} mm</p>
                    </div>
                    <span title={g?.label} className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800">Layout {m.layout_group}</span>
                  </div>
                  <div className="flex justify-center py-2">{g && <CaseDrawing model={m} camera={g.camera} />}</div>
                  <dl className="mt-2 space-y-1 text-xs text-gray-600">
                    <div className="flex justify-between"><dt>Camera covers painting</dt><dd className="font-medium text-gray-900">{ov && ov.depthMm > 0 ? `${ov.depthMm} mm × ${Math.round(ov.widthShare * 100)}% width` : 'clear'}</dd></div>
                    <div className="flex justify-between"><dt>Cut-out</dt><dd className={m.group_verified ? 'text-green-700' : 'text-amber-700'}>{m.group_verified ? 'measured on this model' : 'assumed from its layout'}</dd></div>
                    <div className="flex justify-between"><dt>Price / Gelato cost</dt><dd className="text-gray-900">{gbp(m.price_pence)} / {gbp(m.cost_pence)}</dd></div>
                    <div className="truncate font-mono text-[10px] text-gray-400" title={m.gelato_uid}>{m.gelato_uid}</div>
                  </dl>
                  <label className="mt-3 flex items-center justify-between text-sm">
                    <span>In the dropdown</span>
                    <input type="checkbox" checked={m.is_active} disabled={busy === m.id} onChange={() => toggle(m)} className="h-4 w-4 accent-purple-600" />
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {data && <p className="text-xs text-gray-500">Cases go on sale when phone cases launch (case art and buy sheet are the next phases). Until then the products stay hidden from the shop.</p>}
    </div>
  );
}
