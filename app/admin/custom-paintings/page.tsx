'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, ScanSearch } from 'lucide-react';
import { usd, int } from '@/lib/ai/feature-labels';

type Call = { created_at: string; feature: string; model: string; image_size: string | null; input_tokens: number; thinking_tokens: number; output_image_tokens: number; cost_usd: number | null; duration_ms: number | null; success: boolean; error: string | null };
type Painting = {
  id: string; created_at: string; generated_at: string | null; status: string; error_message: string | null;
  customer_email: string | null; who: string; pet_id: string | null; pet_name: string | null;
  pet_image_url: string; pet_cloudinary_id: string; catalog_image_id: string;
  generated_image_url: string | null; generated_cloudinary_id: string | null; generation_prompt: string | null;
  generation_metadata: any; metadata: any; rating: number | null;
  design: { id: string; public_url: string; cloudinary_public_id: string; description: string | null; breeds?: any; themes?: any; styles?: any; formats?: any } | null;
  calls: Call[];
};

const one = (v: any) => (Array.isArray(v) ? v[0] : v);
const secs = (ms?: number | null) => (ms || ms === 0 ? `${(ms / 1000).toFixed(1)}s` : '–');
/** A Cloudinary original, shrunk for the page (the link opens the full file) */
const shrink = (url: string, w = 900) => (url.includes('/image/upload/') && !/\/upload\/[a-z]_[^/]*\//.test(url) ? url.replace('/image/upload/', `/image/upload/c_limit,w_${w},f_auto,q_auto/`) : url);

function Pic({ label, url, note, full }: { label: string; url?: string | null; note?: string; full?: string | null }) {
  return (
    <figure className="min-w-0">
      <figcaption className="text-xs font-medium text-gray-700 mb-1">{label}{note && <span className="font-normal text-gray-500"> · {note}</span>}</figcaption>
      {url ? (
        <a href={full || url} target="_blank" rel="noreferrer" className="block bg-gray-100 rounded-md overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={label} className="w-full h-72 object-contain" loading="lazy" />
        </a>
      ) : <div className="h-72 grid place-items-center bg-gray-50 rounded-md text-xs text-gray-400">none</div>}
    </figure>
  );
}

function Card({ p }: { p: Painting }) {
  const m = p.generation_metadata || {};
  const t = m.timings || {};
  const pets: string[] = m.pet_image_urls?.length ? m.pet_image_urls : [p.pet_image_url];
  const painting = p.calls.find((c) => c.feature === 'customer-painting');
  const cost = p.calls.reduce((s, c) => s + Number(c.cost_usd ?? 0), 0);
  const d = p.design;
  return (
    <div className="bg-white rounded-lg border p-4 space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <span className="font-semibold text-gray-900 tabular-nums">{new Date(p.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        <span className={p.status === 'complete' ? 'text-green-700' : p.status === 'failed' ? 'text-red-700' : 'text-amber-700'}>{p.status}</span>
        <span className="text-gray-600">{p.customer_email || 'guest'}{p.pet_name ? ` · ${p.pet_name}` : ''}</span>
        {d && <span className="text-gray-600">{one(d.themes)?.name} · {one(d.styles)?.name} · {one(d.breeds)?.name} · {one(d.formats)?.aspect_ratio}</span>}
        <span className="text-gray-600">{m.model} · {m.image_size}</span>
        {painting && <span className="text-gray-600 tabular-nums">{int(painting.input_tokens)} in · {int(painting.thinking_tokens)} thinking · Gemini {secs(painting.duration_ms)}</span>}
        {t.client?.total && <span className="text-gray-600 tabular-nums">phone {secs(t.client.total)}</span>}
        <span className="font-medium tabular-nums">{usd(cost)}</span>
        {p.rating ? <span className="text-gray-600">rated {p.rating}/5</span> : null}
        <span className="text-xs text-gray-400 ml-auto">{p.id}</span>
      </div>
      {p.error_message && <p className="text-sm text-red-700">{p.error_message}</p>}
      <div className={`grid gap-3 ${pets.length > 1 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'}`}>
        <Pic label="Design (as sent to Gemini)" url={m.catalog_image_url || d?.public_url} full={d?.cloudinary_public_id ? `https://res.cloudinary.com/dnhzfz8xv/image/upload/${d.cloudinary_public_id}` : null} />
        {pets.map((u, i) => <Pic key={i} label={pets.length > 1 ? `Pet photo ${i + 1}` : 'Pet photo (as sent)'} url={u} />)}
        <Pic label="Result" url={m.full_size_url ? shrink(m.full_size_url) : p.generated_image_url} full={m.full_size_url || p.generated_image_url} />
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-gray-700">Prompt{p.generation_prompt ? ` (${p.generation_prompt.length} characters)` : ''}</summary>
        <pre className="mt-2 whitespace-pre-wrap text-xs bg-gray-50 rounded p-3 text-gray-800">{p.generation_prompt || '–'}</pre>
      </details>
      <details className="text-sm">
        <summary className="cursor-pointer text-gray-700">Data (metadata, timings, AI calls)</summary>
        <pre className="mt-2 whitespace-pre-wrap text-xs bg-gray-50 rounded p-3 text-gray-800">{JSON.stringify({ generation_metadata: m, metadata: p.metadata, calls: p.calls, design: d, pet_cloudinary_id: p.pet_cloudinary_id, pet_id: p.pet_id }, null, 2)}</pre>
      </details>
    </div>
  );
}

/** Admin > Customer Paintings: what went into each painting, side by side with what came out */
export default function CustomPaintingsPage() {
  const [limit, setLimit] = useState(10);
  const [rows, setRows] = useState<Painting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/custom-paintings?limit=${limit}`, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.statusText);
      setRows(j.paintings); setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [limit]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3"><ScanSearch className="w-8 h-8 text-purple-600" />Customer Paintings</h1>
          <p className="text-gray-600 mt-2">Each customisation with the design and photo Gemini was given, the prompt, and the result. Click an image for the full file.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="h-9 rounded-md border bg-white px-2 text-sm" aria-label="How many">
            {[10, 20, 50].map((n) => <option key={n} value={n}>Last {n}</option>)}
          </select>
          <button onClick={load} className="p-2 rounded-lg border bg-white hover:bg-gray-50" aria-label="Refresh"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>
      {error && <p className="text-red-700">{error}</p>}
      {rows.map((p) => <Card key={p.id} p={p} />)}
    </div>
  );
}
