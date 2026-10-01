'use client';

/**
 * Admin → Quizzes → Breed pictures: each result type's Pawsonalities design painted as the top
 * breeds, made in advance so most quiz takers see their own breed instantly. A grid of
 * breed × type; "Make missing" works through the gaps one at a time (20–60 s each) while the
 * page stays open. Quiz takers with other breeds get theirs made on the spot.
 */
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { AdminSupabaseService } from '@/lib/admin-supabase';

interface Job { type_code: string; breed_id: string; image_id: string | null; status: 'pending' | 'running' | 'done' | 'failed'; error: string | null }
interface Data { animal: 'dog' | 'cat'; breeds: { id: string; name: string }[]; types: { code: string; name: string; design_image_id: string }[]; jobs: Job[] }

export default function BreedPicturesTab({ quizId }: { quizId: string }) {
  const [top, setTop] = useState(20);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState<string | null>(null); // `${code}:${breedId}`
  const [done, setDone] = useState(0);
  const stopRef = useRef(false);
  const service = new AdminSupabaseService();

  async function load() {
    const r = await service.getQuizBreedImages(quizId, top);
    if (r.ok) { setData(r.data); setError(null); } else setError(r.error);
  }
  useEffect(() => { load(); }, [quizId, top]); // eslint-disable-line react-hooks/exhaustive-deps

  const jobFor = (code: string, breedId: string) => data?.jobs.find(j => j.type_code === code && j.breed_id === breedId);
  const missing = data ? data.breeds.flatMap(b => data.types.filter(t => jobFor(t.code, b.id)?.status !== 'done').map(t => ({ code: t.code, breedId: b.id }))) : [];
  const total = data ? data.breeds.length * data.types.length : 0;

  async function makeOne(code: string, breedId: string) {
    setCurrent(`${code}:${breedId}`);
    const r = await service.makeQuizBreedImage(quizId, code, breedId);
    setCurrent(null);
    if (!r.ok) { setError(r.error); return false; }
    setData(d => d ? {
      ...d,
      jobs: [...d.jobs.filter(j => !(j.type_code === code && j.breed_id === breedId)),
        { type_code: code, breed_id: breedId, image_id: r.data.imageId ?? null, status: r.data.status === 'done' ? 'done' : r.data.status === 'pending' ? 'running' : 'failed', error: r.data.error ?? null }],
    } : d);
    return r.data.status === 'done';
  }

  async function makeMissing() {
    stopRef.current = false; setRunning(true); setDone(0); setError(null);
    for (const m of missing) {
      if (stopRef.current) break;
      await makeOne(m.code, m.breedId);
      setDone(n => n + 1);
    }
    setRunning(false);
    load();
  }

  if (error && !data) return <div className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>;
  if (!data) return <p className="text-sm text-gray-600">Loading…</p>;

  if (data.types.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-700">
        No result type has a Pawsonalities design linked yet. Link designs in <strong>Result types</strong>; their breed versions are made here.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="top" className="text-sm font-medium">Breeds</label>
        <select id="top" value={top} onChange={e => setTop(Number(e.target.value))} disabled={running}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
          <option value={10}>Top 10</option><option value={20}>Top 20</option><option value={30}>Top 30</option><option value={50}>Top 50</option><option value={200}>All</option>
        </select>
        <span className="text-sm text-gray-700">{total - missing.length} of {total} made</span>
        {!running ? (
          <button type="button" onClick={makeMissing} disabled={missing.length === 0}
            className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            Make missing ({missing.length})
          </button>
        ) : (
          <button type="button" onClick={() => { stopRef.current = true; }} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold">
            Stop after this one ({done} of {missing.length + done} done)
          </button>
        )}
      </div>
      <p className="text-sm text-gray-600">Each picture takes 20–60 seconds; keep this page open while it works. Breeds outside this list are painted on the spot when someone takes the quiz.</p>
      {error && <div role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="sticky left-0 bg-gray-50 px-3 py-2 text-left font-medium text-gray-600">Breed</th>
              {data.types.map(t => <th key={t.code} title={t.name} className="px-1.5 py-2 font-mono font-bold">{t.code}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.breeds.map(b => (
              <tr key={b.id} className="border-t border-gray-100">
                <th scope="row" className="sticky left-0 whitespace-nowrap bg-white px-3 py-1.5 text-left font-medium text-gray-800">{b.name}</th>
                {data.types.map(t => {
                  const j = jobFor(t.code, b.id);
                  const busy = current === `${t.code}:${b.id}` || j?.status === 'running';
                  return (
                    <td key={t.code} className="px-1 py-1 text-center">
                      {j?.status === 'done' && j.image_id ? (
                        <a href={`/customise/${j.image_id}`} target="_blank" rel="noreferrer" title={`${t.name} · ${b.name}`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded bg-green-100 text-green-800"><Check className="h-4 w-4" aria-label="Made" /></a>
                      ) : busy ? (
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-purple-100 text-purple-800"><Loader2 className="h-4 w-4 animate-spin" aria-label="Painting" /></span>
                      ) : (
                        <button type="button" disabled={running} onClick={() => makeOne(t.code, b.id)}
                          title={j?.status === 'failed' ? `Failed: ${j.error ?? ''} — click to retry` : `Make ${t.name} as a ${b.name}`}
                          className={`inline-flex h-7 w-7 items-center justify-center rounded ${j?.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                          {j?.status === 'failed' ? <AlertTriangle className="h-4 w-4" aria-label="Failed, retry" /> : <span aria-label="Make">+</span>}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
