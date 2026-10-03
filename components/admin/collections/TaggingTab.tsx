'use client';

/**
 * Admin → Collections → Tagging. Progress and the one-off "Tag the catalogue" run, the
 * automatic-tagging switch, and a review grid: each design's tags (edit freely) and the
 * collections it's in (how each got there; take it out or add it by hand; re-tag).
 * Data: /api/admin/collections/designs, /auto-tag via AdminSupabaseService.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Sparkles, X } from 'lucide-react';
import { AdminSupabaseService } from '@/lib/admin-supabase';

interface Collection { id: string; path: string; name: string; depth: number; parent_id: string | null; sort_order: number }
interface Link { collectionId: string; source: 'theme' | 'auto' | 'admin'; excluded: boolean }
interface Design {
  id: string; title: string; thumb: string; breed: string | null; theme: string | null; tags: string[]; tagsEdited: boolean;
  confidence: number | null; taggedAt: string | null; error: string | null; links: Link[];
}
interface ListData { counts: { total: number; untagged: number; failed: number; tagged: number }; total: number; page: number; pageSize: number; designs: Design[] }

const VIEWS: { key: string; label: string }[] = [
  { key: 'recent', label: 'Recently tagged' },
  { key: 'unsure', label: 'Tagger unsure' },
  { key: 'untagged', label: 'Not tagged yet' },
  { key: 'failed', label: 'Tagging failed' },
  { key: 'in', label: 'In a collection…' },
];
const SOURCE_LABEL: Record<Link['source'], string> = { theme: 'from theme', auto: 'auto', admin: 'by hand' };

function DesignCard({ d, collections, label, onChanged }: { d: Design; collections: Collection[]; label: (id: string) => string; onChanged: () => void }) {
  const [tags, setTags] = useState(d.tags);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => setTags(d.tags), [d.tags]);
  const svc = () => new AdminSupabaseService();

  const saveTags = async (next: string[]) => {
    setTags(next); setMsg(null);
    const r = await svc().updateDesignTagging(d.id, { tags: next });
    if (r.ok) setTags(r.data.tags); else setMsg(r.error);
  };
  const addTag = () => {
    const t = input.trim().toLowerCase();
    setInput('');
    if (t && !tags.includes(t)) saveTags([...tags, t]);
  };
  const link = async (body: { add?: string; remove?: string }) => {
    setBusy(true); setMsg(null);
    const r = await svc().updateDesignTagging(d.id, body);
    setBusy(false);
    if (r.ok) onChanged(); else setMsg(r.error);
  };
  const retag = async () => {
    setBusy(true); setMsg(null);
    const r = await svc().updateDesignTagging(d.id, { retag: true });
    setBusy(false);
    if (r.ok) onChanged(); else setMsg(r.error);
  };
  const inIds = new Set(d.links.filter(l => !l.excluded).map(l => l.collectionId));

  return (
    <article className="flex min-w-0 gap-3 rounded-lg border border-gray-200 bg-white p-3" aria-label={d.title}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={d.thumb} alt="" className="h-20 w-20 flex-none rounded object-cover sm:h-28 sm:w-28" loading="lazy" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-start gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900" title={d.title}>{d.title}</p>
          {d.confidence !== null && (
            <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${d.confidence < 0.6 ? 'bg-amber-100 text-amber-900' : 'bg-green-100 text-green-800'}`}>
              {d.confidence < 0.6 ? 'Unsure' : 'Sure'} {Math.round(d.confidence * 100)}%
            </span>
          )}
        </div>
        <p className="text-xs text-gray-600">{[d.breed, d.theme && `theme: ${d.theme}`].filter(Boolean).join(' · ') || '—'}{d.error && <span className="ml-2 text-red-700">Tagging failed: {d.error}</span>}</p>

        <div className="flex flex-wrap items-center gap-1.5" aria-label="Collections">
          {d.links.map(l => (
            <span key={l.collectionId} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${l.excluded ? 'bg-gray-100 text-gray-500 line-through' : 'bg-purple-100 text-purple-900'}`}>
              {label(l.collectionId)} <span className="opacity-70">({l.excluded ? 'taken out' : SOURCE_LABEL[l.source]})</span>
              {l.excluded
                ? <button disabled={busy} onClick={() => link({ add: l.collectionId })} className="ml-0.5 font-semibold no-underline hover:underline">Undo</button>
                : <button disabled={busy} onClick={() => link({ remove: l.collectionId })} aria-label={`Take out of ${label(l.collectionId)}`} className="rounded-full hover:bg-purple-200"><X className="h-3 w-3" /></button>}
            </span>
          ))}
          <select aria-label="Add to a collection" disabled={busy} value="" onChange={e => e.target.value && link({ add: e.target.value })} className="max-w-full rounded border border-gray-300 px-1.5 py-0.5 text-xs text-gray-800">
            <option value="">+ Add to…</option>
            {collections.filter(c => c.depth > 0 && !inIds.has(c.id)).map(c => <option key={c.id} value={c.id}>{label(c.id)}</option>)}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-1.5" aria-label="Tags">
          {tags.map(t => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-800">
              {t}<button onClick={() => saveTags(tags.filter(x => x !== t))} aria-label={`Remove tag ${t}`} className="rounded-full hover:bg-gray-200"><X className="h-3 w-3" /></button>
            </span>
          ))}
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }} onBlur={addTag}
            placeholder="add tag" aria-label="Add a tag" className="w-24 rounded border border-gray-300 px-1.5 py-0.5 text-xs" />
          {d.tagsEdited && <span className="text-xs text-gray-500">edited by hand</span>}
        </div>

        <div className="flex items-center gap-3">
          <button disabled={busy} onClick={retag} className="flex items-center gap-1 text-xs font-medium text-purple-700 hover:underline disabled:opacity-50">
            <RefreshCw className={`h-3 w-3 ${busy ? 'animate-spin' : ''}`} /> {d.taggedAt ? 'Re-tag' : 'Tag now'}
          </button>
          {msg && <span role="alert" className="text-xs text-red-700">{msg}</span>}
        </div>
      </div>
    </article>
  );
}

export default function TaggingTab({ collections }: { collections: Collection[] }) {
  const [view, setView] = useState('recent');
  const [collection, setCollection] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<ListData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [run, setRun] = useState<{ tagged: number; failed: number; remaining: number } | null>(null);
  const [running, setRunning] = useState(false);
  const stop = useRef(false);

  const options = useMemo(() => {
    const out: Collection[] = [];
    const walk = (pid: string | null) => collections.filter(c => c.parent_id === pid).sort((a, b) => a.sort_order - b.sort_order).forEach(c => { out.push(c); walk(c.id); });
    walk(null);
    return out;
  }, [collections]);


  const label = useCallback((id: string) => {
    const c = collections.find(x => x.id === id);
    if (!c) return 'Unknown';
    const parent = collections.find(x => x.id === c.parent_id);
    return c.depth >= 2 && parent ? `${c.name} (${parent.name})` : c.name;
  }, [collections]);

  const load = useCallback(async () => {
    if (view === 'in' && !collection) { setData(null); return; }
    const r = await new AdminSupabaseService().getTaggingDesigns({ view, collection, q, page });
    if (r.ok) { setData(r.data); setError(null); } else setError(r.error);
  }, [view, collection, q, page]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    new AdminSupabaseService().getAppSettings().then(r => setEnabled(r.ok ? r.data.auto_tag_enabled?.value !== false : true));
  }, []);

  const toggle = async (v: boolean) => {
    setEnabled(v);
    const r = await new AdminSupabaseService().updateAppSetting('auto_tag_enabled', v);
    if (!r.ok) { setEnabled(!v); setError(r.error); }
  };

  const tagAll = async (retryFailed = false) => {
    stop.current = false;
    setRunning(true); setError(null);
    let total = { tagged: 0, failed: 0, remaining: (data?.counts.untagged ?? 0) + (retryFailed ? data?.counts.failed ?? 0 : 0) };
    let first = true;
    setRun(total);
    while (!stop.current) {
      const r = await new AdminSupabaseService().autoTagBatch(12, retryFailed && first);
      first = false;
      if (!r.ok) { setError(r.error); break; }
      total = { tagged: total.tagged + r.data.tagged, failed: total.failed + r.data.failed, remaining: r.data.remaining };
      setRun({ ...total });
      // Stop when done, when nothing moved, or when everything is failing (e.g. no API key)
      if (!r.data.remaining || r.data.tagged + r.data.failed === 0 || (total.tagged === 0 && total.failed >= 24)) break;
    }
    setRunning(false);
    load();
  };

  const counts = data?.counts;
  const pct = counts && counts.total ? Math.round((counts.tagged / counts.total) * 100) : 0;
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[14rem] flex-1">
            <p className="text-sm font-semibold text-gray-900">{counts ? `${counts.tagged} of ${counts.total} designs tagged` : 'Loading…'}{counts?.failed ? <span className="ml-2 font-normal text-red-700">· {counts.failed} failed</span> : null}</p>
            <div className="mt-1 h-2 w-full overflow-hidden rounded bg-gray-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Designs tagged">
              <div className="h-full bg-purple-600 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
          {counts && counts.untagged > 0 && (
            <button onClick={() => tagAll()} disabled={running} className="flex items-center gap-1 rounded bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50">
              <Sparkles className="h-4 w-4" /> Tag the catalogue ({counts.untagged} to do)
            </button>
          )}
          {counts && counts.failed > 0 && (
            <button onClick={() => tagAll(true)} disabled={running} className="rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50">
              Try failed ones again ({counts.failed})
            </button>
          )}
          {running && <button onClick={() => { stop.current = true; }} className="rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800">Stop</button>}
        </div>
        {run && <p role="status" className="text-sm text-gray-800">This run: {run.tagged} tagged{run.failed ? `, ${run.failed} failed` : ''}{run.remaining ? `, ${run.remaining} still to do` : ', all done'}.</p>}
        <label className="flex items-start gap-2 text-sm text-gray-800">
          <input type="checkbox" className="mt-0.5" checked={!!enabled} disabled={enabled === null} onChange={e => toggle(e.target.checked)} />
          <span><span className="font-medium">Tag new designs automatically</span><br /><span className="text-gray-600">When a design is saved, Claude picks its collections, the team if it’s a team kit, and 5–10 tags. They go live straight away; fix anything here.</span></span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Show" value={view} onChange={e => { setView(e.target.value); setPage(0); }} className="rounded border border-gray-300 px-2 py-1.5 text-sm">
          {VIEWS.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
        </select>
        {view === 'in' && (
          <select aria-label="Collection" value={collection} onChange={e => { setCollection(e.target.value); setPage(0); }} className="max-w-xs rounded border border-gray-300 px-2 py-1.5 text-sm">
            <option value="">Choose a collection</option>
            {options.map(c => <option key={c.id} value={c.id}>{'  '.repeat(c.depth)}{c.name}</option>)}
          </select>
        )}
        <input type="search" value={q} onChange={e => { setQ(e.target.value); setPage(0); }} placeholder="Find by title or tag" aria-label="Find designs" className="rounded border border-gray-300 px-3 py-1.5 text-sm" />
      </div>

      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {view === 'in' && !collection && <p className="text-sm text-gray-700">Choose a collection to see its designs.</p>}
      {data && (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {data.designs.map(d => <DesignCard key={d.id} d={d} collections={options} label={label} onChanged={load} />)}
          </div>
          {!data.designs.length && <p className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-700">Nothing here.</p>}
          {data.total > data.pageSize && (
            <div className="flex items-center justify-center gap-3 text-sm">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="rounded border border-gray-300 px-3 py-1.5 disabled:opacity-40">Previous</button>
              <span className="text-gray-700">Page {page + 1} of {Math.ceil(data.total / data.pageSize)}</span>
              <button disabled={(page + 1) * data.pageSize >= data.total} onClick={() => setPage(p => p + 1)} className="rounded border border-gray-300 px-3 py-1.5 disabled:opacity-40">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
