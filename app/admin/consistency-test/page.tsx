'use client';

import { useEffect, useRef, useState } from 'react';
import { ScanSearch, Upload, Wand2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReferencePicker, type Ref } from '@/components/admin/VariationRunDialog';

type Variant = { key: string; label: string; model: string; design: 'live' | 'clean'; prompt: 'live' | 'focused' };
type Result = { variant: string; repeat: number; ok: boolean; seconds: number; url?: string; thinking?: number; input?: number; costUsd?: number | null; error?: string };
type Test = {
  testId: string; at: string; size: string; petUrl: string | null;
  design: { id: string; title: string; aspectRatio: string | null; animal: string | null };
  designUrls: Record<string, string>; prompts: Record<string, string>; variants: Variant[]; results: Result[];
};
type Recent = { id: string; created_at: string; pet_image_url: string; design: { public_url: string } | null };

const DEFAULT_VARIANTS = ['live', 'clean', 'clean-focused', 'old'];
const usd = (v?: number | null) => (v == null ? '–' : `$${v.toFixed(3)}`);
const small = (u: string, w = 500) => (u.includes('/image/upload/') ? u.replace('/image/upload/', `/image/upload/c_limit,w_${w},f_auto,q_auto/`) : u);

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

function Thumb({ url, label, sub }: { url?: string; label?: string; sub?: string }) {
  return (
    <figure className="min-w-0">
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="block bg-gray-100 rounded-md overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={small(url)} alt={label || ''} className="w-full aspect-[2/3] object-contain" loading="lazy" />
        </a>
      ) : <div className="w-full aspect-[2/3] grid place-items-center bg-red-50 rounded-md text-xs text-red-700 p-2 text-center">{sub || 'Failed'}</div>}
      {label && <figcaption className="text-[11px] text-gray-500 mt-1 tabular-nums">{label}</figcaption>}
    </figure>
  );
}

function TestResults({ t }: { t: Test }) {
  const repeats = Math.max(...t.results.map((r) => r.repeat), 1);
  return (
    <div className="bg-white rounded-lg border p-4 space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-4 text-sm">
        <span className="font-semibold text-gray-900">{t.design.title || 'Design'}</span>
        <span className="text-gray-600">{t.design.animal} · {t.design.aspectRatio} · {t.size}</span>
        <span className="text-gray-500">{new Date(t.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        <span className="font-medium ml-auto tabular-nums">{usd(t.results.reduce((s, r) => s + (r.costUsd ?? 0), 0))}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-separate border-spacing-2">
          <thead>
            <tr className="text-xs text-gray-500">
              <th className="text-left font-medium align-bottom w-40">Set-up</th>
              <th className="font-medium">Design as sent</th>
              <th className="font-medium">Pet photo</th>
              {Array.from({ length: repeats }, (_, i) => <th key={i} className="font-medium">Run {i + 1}</th>)}
            </tr>
          </thead>
          <tbody>
            {t.variants.map((v) => (
              <tr key={v.key} className="align-top">
                <td className="text-gray-800">
                  <p className="font-medium">{v.label}</p>
                  <p className="text-xs text-gray-500">{v.model}<br />{v.design === 'clean' ? 'clean 1024px design' : 'design as live'} · {v.prompt} prompt</p>
                </td>
                <td className="w-36"><Thumb url={t.designUrls[v.design]} /></td>
                <td className="w-36"><Thumb url={t.petUrl || undefined} sub="not recorded" /></td>
                {Array.from({ length: repeats }, (_, i) => {
                  const r = t.results.find((x) => x.variant === v.key && x.repeat === i + 1);
                  return (
                    <td key={i} className="w-48">
                      {r && <Thumb url={r.ok ? r.url : undefined} sub={r.error} label={r.ok ? `${r.seconds}s · ${r.thinking} thinking · ${usd(r.costUsd)}` : `${r.seconds}s`} />}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {Object.entries(t.prompts).filter(([k]) => t.variants.some((v) => v.prompt === k)).map(([k, p]) => (
        <details key={k} className="text-sm">
          <summary className="cursor-pointer text-gray-700">{k === 'live' ? 'Live prompt' : 'Focused prompt'} ({p.length} characters)</summary>
          <pre className="mt-2 whitespace-pre-wrap text-xs bg-gray-50 rounded p-3 text-gray-800">{p}</pre>
        </details>
      ))}
    </div>
  );
}

/** Admin > Consistency Test: same design and photo, several set-ups, several runs each */
export default function ConsistencyTestPage() {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [maxCalls, setMaxCalls] = useState(15);
  const [chosen, setChosen] = useState<string[]>(DEFAULT_VARIANTS);
  const [repeats, setRepeats] = useState(3);
  const [design, setDesign] = useState<Ref[]>([]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [petUrl, setPetUrl] = useState<string | null>(null);
  const [running, setRunning] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tests, setTests] = useState<Test[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Set-ups and earlier tests (kept in the AI call log, so they survive a reload)
    fetch('/api/admin/consistency-test').then((r) => r.json()).then((b) => { setVariants(b.variants ?? []); setMaxCalls(b.maxCalls ?? 15); setTests(b.history ?? []); }).catch(() => undefined);
    fetch('/api/admin/custom-paintings?limit=12').then((r) => r.json()).then((b) => {
      // One entry per distinct photo
      const seen = new Set<string>();
      setRecent((b.paintings ?? []).filter((p: Recent) => p.pet_image_url && !seen.has(p.pet_image_url) && seen.add(p.pet_image_url)));
    }).catch(() => undefined);
  }, []);

  const calls = chosen.length * repeats;
  const toggle = (k: string) => setChosen((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]));

  const run = async () => {
    if (!design[0] || (!photo && !petUrl)) return;
    setRunning(Date.now()); setError(null);
    try {
      const form = new FormData();
      form.set('catalogImageId', design[0].id);
      if (photo) form.set('photo', await shrink(photo), 'pet.jpg');
      else if (petUrl) form.set('petUrl', petUrl);
      form.set('variants', variants.filter((v) => chosen.includes(v.key)).map((v) => v.key).join(','));
      form.set('repeats', String(repeats));
      const res = await fetch('/api/admin/consistency-test', { method: 'POST', body: form });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || (res.status === 504 ? 'Timed out (over 5 minutes); try fewer runs' : res.statusText));
      setTests((t) => [{ ...body, at: new Date().toISOString() }, ...t.filter((x) => x.testId !== body.testId)]);
    } catch (e: any) { setError(e.message); } finally { setRunning(null); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3"><ScanSearch className="w-8 h-8 text-purple-600" /> Consistency Test</h1>
        <p className="text-gray-600 mt-2">
          Paint one design with one pet photo several times, with each set-up you choose, and compare them side by side: is the pet faithful, and is it the same pet every run?
          Nothing here reaches customers. Single-pet designs only.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm font-medium text-gray-700 mb-2">1. Design {design[0] && <span className="text-gray-500 font-normal">· {design[0].title}</span>}</p>
          <ReferencePicker selected={design} onChange={(r) => setDesign(r.slice(-1))} />
          {design[0]?.pets && design[0].pets > 1 && <p className="text-xs text-amber-700 mt-2">This design has {design[0].pets} pets; the test paints one.</p>}
        </div>
        <div className="space-y-4">
          <div className="bg-white rounded-lg border p-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">2. Pet photo</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setPhoto(f); setPetUrl(null); } e.target.value = ''; }} />
            <div className="flex flex-wrap gap-2">
              {photo ? (
                <div className="relative w-20 h-20 rounded-lg overflow-hidden border-2 border-purple-600">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={URL.createObjectURL(photo)} alt="Pet" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setPhoto(null)} className="absolute top-0.5 right-0.5 rounded-full bg-black/60 text-white p-0.5" aria-label="Remove photo"><X className="w-3 h-3" /></button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()} className="w-20 h-20 rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-xs text-gray-500 hover:bg-gray-50">
                  <Upload className="w-4 h-4 mb-1" /> Upload
                </button>
              )}
            </div>
            {recent.length > 0 && (
              <>
                <p className="text-xs text-gray-500">Or use a photo from a recent customisation:</p>
                <div className="flex flex-wrap gap-2">
                  {recent.map((p) => (
                    <button key={p.id} type="button" onClick={() => { setPetUrl(p.pet_image_url); setPhoto(null); }}
                      className={`w-14 h-14 rounded-md overflow-hidden border-2 ${petUrl === p.pet_image_url ? 'border-purple-600' : 'border-transparent'}`}
                      title={new Date(p.created_at).toLocaleString('en-GB')} aria-label={`Photo from ${new Date(p.created_at).toLocaleString('en-GB')}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={small(p.pet_image_url, 120)} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="bg-white rounded-lg border p-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">3. Set-ups</p>
            {variants.map((v) => (
              <label key={v.key} className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={chosen.includes(v.key)} onChange={() => toggle(v.key)} className="mt-1" />
                <span>{v.label}<span className="block text-xs text-gray-500">{v.model} · {v.design === 'clean' ? 'clean 1024px design' : 'design as live'} · {v.prompt} prompt</span></span>
              </label>
            ))}
            <label className="flex items-center gap-2 text-sm">
              Runs of each
              <select value={repeats} onChange={(e) => setRepeats(Number(e.target.value))} className="h-8 rounded-md border bg-white px-2">
                {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <Button className="w-full" onClick={run} disabled={!!running || !design[0] || (!photo && !petUrl) || !chosen.length || calls > maxCalls}>
              <Wand2 className="w-4 h-4 mr-2" />
              {running ? <>Painting {calls}… <Elapsed since={running} /></> : calls > maxCalls ? `At most ${maxCalls} paintings` : `Paint ${calls} (about $${(calls * 0.06).toFixed(2)})`}
            </Button>
            {running && <p className="text-xs text-gray-500">Up to 8 at a time; usually one to two minutes.</p>}
            {error && <p className="text-sm text-red-700">{error}</p>}
          </div>
        </div>
      </div>

      {tests.map((t) => <TestResults key={t.testId} t={t} />)}
    </div>
  );
}
