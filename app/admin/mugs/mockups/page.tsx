'use client';

import { useEffect, useRef, useState } from 'react';
import { Coffee, Upload } from 'lucide-react';
import { mockupUrl, DEFAULT_FACES, type FaceBox } from '@/lib/mugs/mockup-url';

type Photo = { publicId: string; url: string; width: number; height: number; uploadedAt: string; face?: FaceBox; background?: string };
type Photos = Partial<Record<'pet' | 'text', Photo>>;

const SIDES: { side: 'pet' | 'text'; title: string; help: string }[] = [
  { side: 'pet', title: 'Pet side', help: 'Plain white mug with the handle on the RIGHT. Shows the left half of the wrap: the pet and their name.' },
  { side: 'text', title: 'Text side', help: 'Plain white mug with the handle on the LEFT. Shows the right half: the sign’s heading and description.' },
];

/** Admin → Mugs → Mockup photos: the blank mug photos customer mug previews are built on */
export default function MugMockupsPage() {
  const [photos, setPhotos] = useState<Photos>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sampleWrap, setSampleWrap] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/mugs/mockups').then((r) => r.json()).then((d) => { setPhotos(d.photos || {}); setSampleWrap(d.sampleWrap || null); }).catch(() => setError('Could not load'));
  }, []);

  async function saveFace(side: 'pet' | 'text', face: FaceBox) {
    setBusy(side); setError(null);
    try {
      const r = await fetch('/api/admin/mugs/mockups', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ side, face }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Save failed');
      setPhotos(d.photos || {});
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function upload(side: 'pet' | 'text', file: File) {
    setBusy(side); setError(null);
    try {
      const fd = new FormData();
      fd.append('side', side);
      fd.append('file', file);
      const r = await fetch('/api/admin/mugs/mockups', { method: 'POST', body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Upload failed');
      setPhotos(d.photos || {});
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3"><Coffee className="w-8 h-8 text-purple-600" /> Mug mockup photos</h1>
        <p className="text-gray-600 mt-2 max-w-3xl">
          Two photos of a plain white 11oz mug (black or dark inside and handle is fine: they are recoloured to the customer’s choice).
          The customer’s design is placed on the mug’s face in each, so it looks like a real mug from both sides.
          Use straight-on photos on a plain background, at least 1000 px.
        </p>
      </div>
      {error && <p className="text-red-700">{error}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {SIDES.map((s) => <Slot key={s.side} {...s} photo={photos[s.side]} busy={busy === s.side} sampleWrap={sampleWrap}
          onFile={(f) => upload(s.side, f)} onSaveFace={(face) => saveFace(s.side, face)} />)}
      </div>
    </div>
  );
}

function Slot({ side, title, help, photo, busy, sampleWrap, onFile, onSaveFace }: {
  side: 'pet' | 'text'; title: string; help: string; photo?: Photo; busy: boolean; sampleWrap: string | null;
  onFile: (f: File) => void; onSaveFace: (face: FaceBox) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const saved = photo?.face ?? DEFAULT_FACES[side];
  const [face, setFace] = useState<FaceBox>(saved);
  useEffect(() => { setFace(photo?.face ?? DEFAULT_FACES[side]); }, [photo?.publicId, photo?.face, side]);
  const changed = (['x', 'y', 'w', 'h'] as const).some((k) => Math.abs(face[k] - saved[k]) > 1e-6);
  const preview = photo && sampleWrap ? mockupUrl(side, { ...photo, face }, sampleWrap, '012168', 700) : null;
  return (
    <div className="bg-white rounded-lg border p-4 space-y-3">
      <div>
        <h2 className="font-semibold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-600">{help}</p>
      </div>
      <div className="aspect-square rounded-md bg-gray-100 overflow-hidden grid place-items-center">
        {photo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={photo.url.replace('/image/upload/', '/image/upload/c_limit,w_700,f_auto,q_auto/')} alt={title} className="w-full h-full object-contain" />
          : <span className="text-sm text-gray-400">No photo yet</span>}
      </div>
      {photo && <p className="text-xs text-gray-500">{photo.width}×{photo.height}px · {new Date(photo.uploadedAt).toLocaleString('en-GB')}</p>}
      {photo && (
        <div className="space-y-2 border-t pt-3">
          <p className="text-sm font-medium text-gray-800">Where the design goes</p>
          {preview
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={preview} alt={`${title} with the latest mug design`} className="w-full rounded-md bg-gray-100" />
            : <p className="text-xs text-gray-500">Make a mug on the site to see a preview here.</p>}
          <div className="grid grid-cols-4 gap-2">
            {(['x', 'y', 'w', 'h'] as const).map((k) => (
              <label key={k} className="text-xs text-gray-600">
                {{ x: 'Left %', y: 'Top %', w: 'Width %', h: 'Height %' }[k]}
                <input type="number" step="0.5" min={0} max={100} value={Math.round(face[k] * 1000) / 10}
                  onChange={(e) => setFace((f) => ({ ...f, [k]: Math.min(Math.max(Number(e.target.value) / 100, 0), 1) }))}
                  className="mt-1 h-9 w-full rounded-md border px-2 text-sm text-gray-900" />
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => onSaveFace(face)} disabled={busy || !changed} className="rounded-lg border border-purple-300 px-3 py-1.5 text-sm font-semibold text-purple-800 disabled:opacity-40">Save position</button>
            {changed && <button onClick={() => setFace(saved)} className="text-sm text-gray-600 hover:underline">Undo</button>}
          </div>
        </div>
      )}
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFile(f); }} />
      <button onClick={() => ref.current?.click()} disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        <Upload className="w-4 h-4" /> {busy ? 'Uploading…' : photo ? 'Replace photo' : 'Upload photo'}
      </button>
    </div>
  );
}
