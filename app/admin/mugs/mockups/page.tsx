'use client';

import { useEffect, useRef, useState } from 'react';
import { Coffee, Upload } from 'lucide-react';

type Photo = { publicId: string; url: string; width: number; height: number; uploadedAt: string };
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

  useEffect(() => {
    fetch('/api/admin/mugs/mockups').then((r) => r.json()).then((d) => setPhotos(d.photos || {})).catch(() => setError('Could not load'));
  }, []);

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
        {SIDES.map((s) => <Slot key={s.side} {...s} photo={photos[s.side]} busy={busy === s.side} onFile={(f) => upload(s.side, f)} />)}
      </div>
    </div>
  );
}

function Slot({ title, help, photo, busy, onFile }: { title: string; help: string; photo?: Photo; busy: boolean; onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
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
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFile(f); }} />
      <button onClick={() => ref.current?.click()} disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        <Upload className="w-4 h-4" /> {busy ? 'Uploading…' : photo ? 'Replace photo' : 'Upload photo'}
      </button>
    </div>
  );
}
