'use client';

import { useEffect, useRef, useState } from 'react';
import { Ruler, Upload, Wand2, ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReferencePicker, type Ref } from '@/components/admin/VariationRunDialog';

type Result = {
  label: string; size: string; ok: boolean; seconds: number; error?: string;
  url?: string; width?: number; height?: number; bytes?: number; costUsd?: number | null;
  tokens?: { input: number; thinking: number; image: number } | null;
};
type Test = { testId: string; design: { id: string; title: string; aspectRatio: string | null }; customerPreviewSize: string; prompt: string; petUrls: string[]; results: Result[]; at: string };

const ORDER = ['1K preview', '2K preview', '4K preview', '4K master from the 1K'];
const usd = (v?: number | null) => (v == null ? '–' : `$${v.toFixed(3)}`);
const mb = (b?: number) => (b ? `${(b / 1_048_576).toFixed(1)} MB` : '–');

/** Shrink a phone photo before upload (keeps the request under Vercel's 4.5 MB); the server stores pets at ≤1024 px anyway */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 2048 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', 0.9));
}

function Elapsed({ since }: { since: number }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 500); return () => clearInterval(t); }, []);
  return <span className="tabular-nums">{((Date.now() - since) / 1000).toFixed(0)}s</span>;
}

export default function SizeTestPage() {
  const [design, setDesign] = useState<Ref[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [sizes, setSizes] = useState<string[]>(['1K', '4K']);
  const [master, setMaster] = useState(true);
  const [running, setRunning] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tests, setTests] = useState<Test[]>([]);
  const [view, setView] = useState<'fit' | 'phone' | 'detail'>('phone');
  const [zoom, setZoom] = useState({ x: 50, y: 35 });
  const fileRef = useRef<HTMLInputElement>(null);
  const pets = design[0]?.pets ?? 1;
  const [previewSize, setPreviewSize] = useState<string | null>(null);
  useEffect(() => { fetch('/api/admin/size-test').then((r) => r.json()).then((b) => setPreviewSize(b.customerPreviewSize ?? null)).catch(() => undefined); }, []);

  const run = async () => {
    if (!design[0] || !photos.length) return;
    setRunning(Date.now()); setError(null);
    try {
      const form = new FormData();
      form.set('catalogImageId', design[0].id);
      for (const p of photos.slice(0, pets)) form.append('photos', await shrink(p), p.name.replace(/\.[^.]+$/, '') + '.jpg');
      form.set('sizes', sizes.join(','));
      form.set('master', master ? '1' : '0');
      const res = await fetch('/api/admin/size-test', { method: 'POST', body: form });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || (res.status === 504 ? 'Timed out (over 5 minutes)' : res.statusText));
      body.results.sort((a: Result, b: Result) => ORDER.indexOf(a.label) - ORDER.indexOf(b.label));
      setTests((t) => [{ ...body, at: new Date().toISOString() }, ...t]);
    } catch (e: any) { setError(e.message); } finally { setRunning(null); }
  };

  const toggleSize = (s: string) => setSizes((v) => (v.includes(s) ? v.filter((x) => x !== s) : [...v, s].sort()));
  const expected = [...(master && !sizes.includes('1K') ? ['1K'] : []), ...sizes].length + (master ? 1 : 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3"><Ruler className="w-8 h-8 text-purple-600" /> Preview Size Test</h1>
        <p className="text-gray-600 mt-2">
          Make one customer painting at several sizes from the same prompt and photo, and see them side by side, including the 4K print master a buyer would get from a 1K preview.
          Customer previews are currently made at <strong>{previewSize ?? '…'}</strong> (set by <code>GEMINI_CUSTOMER_PREVIEW_SIZE</code> in Vercel).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm font-medium text-gray-700 mb-2">1. Design {design[0] && <span className="text-gray-500 font-normal">· {design[0].title}{pets > 1 ? ` · ${pets} pets` : ''}</span>}</p>
          <ReferencePicker selected={design} onChange={(r) => setDesign(r.slice(-1))} />
        </div>
        <div className="space-y-4">
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm font-medium text-gray-700 mb-2">2. Pet photo{pets > 1 ? `s (one per pet, left to right)` : ''}</p>
            <input ref={fileRef} type="file" accept="image/*" multiple={pets > 1} className="hidden"
              onChange={(e) => { const added = Array.from(e.target.files ?? []); setPhotos((p) => [...p, ...added].slice(0, pets)); e.target.value = ''; }} />
            <div className="flex flex-wrap gap-2">
              {photos.map((p, i) => (
                <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border">
                  <img src={URL.createObjectURL(p)} alt={`Pet ${i + 1}`} className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))} className="absolute top-0.5 right-0.5 rounded-full bg-black/60 text-white p-0.5" aria-label="Remove photo"><X className="w-3 h-3" /></button>
                </div>
              ))}
              {photos.length < pets && (
                <button type="button" onClick={() => fileRef.current?.click()} className="w-20 h-20 rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-xs text-gray-500 hover:bg-gray-50">
                  <Upload className="w-4 h-4 mb-1" /> Add photo
                </button>
              )}
            </div>
          </div>
          <div className="bg-white rounded-lg border p-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">3. Sizes</p>
            <div className="flex gap-2">
              {['1K', '2K', '4K'].map((s) => (
                <label key={s} className={`flex-1 text-center cursor-pointer rounded-md border px-3 py-2 text-sm ${sizes.includes(s) ? 'bg-purple-600 text-white border-purple-600' : 'bg-white'}`}>
                  <input type="checkbox" className="sr-only" checked={sizes.includes(s)} onChange={() => toggleSize(s)} />{s}
                </label>
              ))}
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={master} onChange={(e) => setMaster(e.target.checked)} className="mt-1" />
              <span>Also make the <strong>4K print master from the 1K</strong> (what a buyer gets if previews are 1K)</span>
            </label>
            <Button className="w-full" onClick={run} disabled={!!running || !design[0] || photos.length < pets || expected === 0}>
              <Wand2 className="w-4 h-4 mr-2" /> {running ? <>Generating {expected} images… <Elapsed since={running} /></> : `Generate ${expected} image${expected === 1 ? '' : 's'}`}
            </Button>
            {running && <p className="text-xs text-gray-500">Sizes run at the same time; the master starts once the 1K is back. 4K can take a minute or two.</p>}
            {error && <p className="text-sm text-red-700">{error}</p>}
          </div>
        </div>
      </div>

      {tests.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border bg-white p-1" role="group" aria-label="View">
            {([['phone', 'Phone size'], ['fit', 'Side by side'], ['detail', 'Same detail, zoomed']] as const).map(([k, l]) => (
              <button key={k} type="button" aria-pressed={view === k} onClick={() => setView(k)} className={`px-3 py-1.5 text-sm rounded-md ${view === k ? 'bg-purple-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>{l}</button>
            ))}
          </div>
          {view === 'detail' && <span className="text-xs text-gray-500">Click any image to choose the spot to zoom into.</span>}
          {view === 'phone' && <span className="text-xs text-gray-500">Each image at a phone’s width (390 px), as a customer sees it.</span>}
        </div>
      )}

      {tests.map((t) => (
        <div key={t.testId} className="bg-white rounded-lg border p-4 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold text-gray-900">{t.design.title || 'Design'}</h2>
            <span className="text-xs text-gray-500">{new Date(t.at).toLocaleTimeString('en-GB')} · {t.design.aspectRatio ?? 'design shape'}</span>
          </div>
          <div className={`grid gap-4 ${view === 'phone' ? 'grid-cols-[repeat(auto-fill,390px)]' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'}`}>
            {t.results.map((r) => (
              <figure key={r.label} className="space-y-2">
                <figcaption className="flex items-baseline justify-between gap-2 text-sm">
                  <strong>{r.label}</strong>
                  {r.ok && <span className="text-xs text-gray-600 tabular-nums">{r.width}×{r.height}</span>}
                </figcaption>
                {r.ok && r.url ? (
                  view === 'detail' ? (
                    <div
                      role="img"
                      aria-label={`${r.label}, zoomed detail`}
                      onClick={(e) => { const b = (e.currentTarget as HTMLDivElement).getBoundingClientRect(); setZoom({ x: ((e.clientX - b.left) / b.width) * 100, y: ((e.clientY - b.top) / b.height) * 100 }); }}
                      className="w-full aspect-square rounded-lg border cursor-crosshair bg-no-repeat"
                      style={{ backgroundImage: `url(${r.url})`, backgroundSize: '400%', backgroundPosition: `${zoom.x}% ${zoom.y}%` }}
                    />
                  ) : (
                    <img src={r.url} alt={r.label} className={`rounded-lg border bg-gray-50 ${view === 'phone' ? 'w-[390px]' : 'w-full'}`} loading="lazy"
                      onClick={(e) => { if (view !== 'fit') return; const b = (e.target as HTMLImageElement).getBoundingClientRect(); setZoom({ x: ((e.clientX - b.left) / b.width) * 100, y: ((e.clientY - b.top) / b.height) * 100 }); setView('detail'); }} />
                  )
                ) : (
                  <div className="aspect-square rounded-lg border bg-red-50 text-red-800 text-sm p-3">{r.error}</div>
                )}
                <dl className="grid grid-cols-2 gap-x-3 text-xs text-gray-600">
                  <dt>Time</dt><dd className="tabular-nums text-right">{r.seconds}s</dd>
                  <dt>File</dt><dd className="tabular-nums text-right">{mb(r.bytes)}</dd>
                  <dt>Cost</dt><dd className="tabular-nums text-right">{usd(r.costUsd)}{r.label.includes('master') ? ' est.' : ''}</dd>
                  {r.tokens && <><dt>Thinking</dt><dd className="tabular-nums text-right">{r.tokens.thinking.toLocaleString('en-GB')} tok</dd></>}
                </dl>
                {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-purple-700 hover:underline"><ExternalLink className="w-3 h-3" /> Full size</a>}
              </figure>
            ))}
          </div>
          <details className="text-xs text-gray-600">
            <summary className="cursor-pointer">Prompt and inputs (identical for every size)</summary>
            <div className="flex gap-2 my-2">{t.petUrls.map((u) => <img key={u} src={u} alt="Pet photo used" className="w-16 h-16 object-cover rounded border" />)}</div>
            <pre className="whitespace-pre-wrap bg-gray-50 rounded p-2 max-h-60 overflow-y-auto">{t.prompt}</pre>
          </details>
        </div>
      ))}
    </div>
  );
}
