'use client';

/**
 * Admin → Collections (docs/specs/collections-plan.md, phase 1). The few places customers browse
 * besides breed: Occasions, Sports (leagues → teams), 16 Pawsonalities, Zodiac. Edit names,
 * seasons (when an occasion is promoted), search words and order; add occasions or teams; and
 * point each theme at a collection so its designs are filed automatically.
 * Data: /api/admin/collections* via AdminSupabaseService.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, RefreshCw, Sparkles } from 'lucide-react';
import { AdminSupabaseService } from '@/lib/admin-supabase';
import TaggingTab from '@/components/admin/collections/TaggingTab';

interface Window { start: string; end: string }
interface Collection {
  id: string; kind: string; parent_id: string | null; slug: string; path: string; depth: number;
  name: string; short_name: string | null; description: string | null; season_windows: Window[];
  metadata: any; search_terms: string[]; sort_order: number; is_active: boolean; designs: number; in_season: boolean | null;
}
interface Theme { id: string; name: string; slug: string; is_active: boolean; default_collection_id: string | null; designs: number; suggested_collection_id: string | null }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const md = (s: string) => { const [m, d] = s.split('-').map(Number); return `${d} ${MONTHS[m - 1] ?? '?'}`; };

function SeasonBadge({ c }: { c: Collection }) {
  if (c.kind !== 'occasion' || c.depth === 0) return null;
  if (c.in_season === null) return <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">All year</span>;
  return c.in_season
    ? <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">In season</span>
    : <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">Out of season</span>;
}

function Editor({ c, onSaved, onCancel }: { c: Collection; onSaved: () => void; onCancel: () => void }) {
  const [name, setName] = useState(c.name);
  const [short, setShort] = useState(c.short_name ?? '');
  const [description, setDescription] = useState(c.description ?? '');
  const [terms, setTerms] = useState(c.search_terms.join(', '));
  const [windows, setWindows] = useState<Window[]>(c.season_windows ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true); setError(null);
    const r = await new AdminSupabaseService().updateCollection(c.id, {
      name, short_name: short, description, search_terms: terms,
      ...(c.kind === 'occasion' && c.depth > 0 ? { season_windows: windows } : {}),
    });
    setSaving(false);
    if (r.ok) onSaved(); else setError(r.error || 'Could not save');
  };

  return (
    <div className="mt-2 space-y-3 rounded-lg border border-purple-200 bg-purple-50/40 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-gray-800">Name
          <input value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-sm font-medium text-gray-800">Short name <span className="font-normal text-gray-600">(chips, small screens)</span>
          <input value={short} onChange={e => setShort(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
        </label>
      </div>
      <label className="block text-sm font-medium text-gray-800">Description <span className="font-normal text-gray-600">(shown at the top of the collection page)</span>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
      </label>
      <label className="block text-sm font-medium text-gray-800">Other words people search for <span className="font-normal text-gray-600">(comma separated)</span>
        <input value={terms} onChange={e => setTerms(e.target.value)} placeholder="xmas, festive, santa" className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
      </label>
      {c.kind === 'occasion' && c.depth > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-800">When to promote it</p>
          <p className="text-xs text-gray-600">Month-day, e.g. 11-01 to 12-26. Leave empty for all year. Out of season it can still be found, it just isn’t pushed.</p>
          <div className="mt-2 space-y-2">
            {windows.map((w, i) => (
              <div key={i} className="flex items-center gap-2">
                <input aria-label="From" value={w.start} onChange={e => setWindows(ws => ws.map((x, j) => j === i ? { ...x, start: e.target.value } : x))} className="w-24 rounded border border-gray-300 px-2 py-1 text-sm" placeholder="11-01" />
                <span className="text-sm text-gray-600">to</span>
                <input aria-label="To" value={w.end} onChange={e => setWindows(ws => ws.map((x, j) => j === i ? { ...x, end: e.target.value } : x))} className="w-24 rounded border border-gray-300 px-2 py-1 text-sm" placeholder="12-26" />
                <button type="button" onClick={() => setWindows(ws => ws.filter((_, j) => j !== i))} className="text-sm text-red-700 hover:underline">Remove</button>
              </div>
            ))}
            {windows.length < 4 && (
              <button type="button" onClick={() => setWindows(ws => [...ws, { start: '', end: '' }])} className="text-sm font-medium text-purple-700 hover:underline">+ Add a window</button>
            )}
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="rounded bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
        <button onClick={onCancel} className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50">Cancel</button>
      </div>
    </div>
  );
}

function AddChild({ parent, onAdded }: { parent: Collection; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const label = parent.kind === 'occasion' ? 'occasion' : parent.depth === 1 ? 'team' : parent.kind === 'sport' ? 'league' : 'collection';
  if (!open) return <button onClick={() => setOpen(true)} className="mt-1 flex items-center gap-1 text-sm font-medium text-purple-700 hover:underline"><Plus className="h-4 w-4" /> Add {label}</button>;
  const add = async () => {
    setError(null);
    const r = await new AdminSupabaseService().createCollection({ parent_id: parent.id, name });
    if (r.ok) { setName(''); setOpen(false); onAdded(); } else setError(r.error || 'Could not add');
  };
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <input autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder={`New ${label} name`} className="rounded border border-gray-300 px-3 py-1.5 text-sm" />
      <button onClick={add} disabled={!name.trim()} className="rounded bg-purple-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Add</button>
      <button onClick={() => setOpen(false)} className="text-sm text-gray-700 hover:underline">Cancel</button>
      {parent.kind === 'sport' && parent.depth === 1 && <p className="w-full text-xs text-gray-600">Teams added here have no kit yet. Kits for the built-in teams come from lib/collections/sports-teams.ts.</p>}
      {error && <p role="alert" className="w-full text-sm text-red-700">{error}</p>}
    </div>
  );
}

function Row({ c, all, open, toggle, editing, setEditing, reload }: {
  c: Collection; all: Collection[]; open: Set<string>; toggle: (id: string) => void;
  editing: string | null; setEditing: (id: string | null) => void; reload: () => void;
}) {
  const children = all.filter(x => x.parent_id === c.id);
  const isOpen = open.has(c.id);
  const childDesigns = (id: string): number => all.filter(x => x.parent_id === id).reduce((n, x) => n + x.designs + childDesigns(x.id), 0);
  const total = c.designs + childDesigns(c.id);
  const setActive = async (v: boolean) => { await new AdminSupabaseService().updateCollection(c.id, { is_active: v }); reload(); };

  return (
    <li className={c.depth === 0 ? 'rounded-lg border border-gray-200 bg-white p-4' : 'border-t border-gray-100 py-2 pl-2'}>
      <div className="flex flex-wrap items-center gap-2">
        {children.length || c.depth < 2 ? (
          <button onClick={() => toggle(c.id)} aria-expanded={isOpen} aria-label={`${isOpen ? 'Close' : 'Open'} ${c.name}`} className="rounded p-0.5 text-gray-600 hover:bg-gray-100">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : <span className="w-5" />}
        <span className={`${c.depth === 0 ? 'text-lg font-semibold' : 'font-medium'} ${c.is_active ? 'text-gray-900' : 'text-gray-500 line-through'}`}>{c.name}</span>
        {c.short_name && c.short_name !== c.name && <span className="text-sm text-gray-600">({c.short_name})</span>}
        {Array.isArray(c.metadata?.colours) && (
          <span className="flex gap-0.5" aria-label="Team colours">
            {c.metadata.colours.map((k: any) => <span key={k.hex} title={k.name} className="h-3.5 w-3.5 rounded-sm border border-gray-300" style={{ background: k.hex }} />)}
          </span>
        )}
        {c.metadata?.symbol && <span className="text-gray-700">{c.metadata.symbol} <span className="text-xs">{md(c.metadata.from)} – {md(c.metadata.to)}</span></span>}
        <SeasonBadge c={c} />
        {c.season_windows?.length > 0 && <span className="text-xs text-gray-600">{c.season_windows.map(w => `${md(w.start)} – ${md(w.end)}`).join(' · ')}</span>}
        <span className="ml-auto flex items-center gap-3 text-sm">
          <span className={total ? 'text-gray-800' : 'text-amber-800'}>{total} design{total === 1 ? '' : 's'}{children.length ? ` · ${children.length} inside` : ''}</span>
          <label className="flex items-center gap-1 text-gray-700"><input type="checkbox" checked={c.is_active} onChange={e => setActive(e.target.checked)} /> Live</label>
          <button onClick={() => setEditing(editing === c.id ? null : c.id)} className="font-medium text-purple-700 hover:underline">Edit</button>
        </span>
      </div>
      {editing === c.id && <Editor c={c} onSaved={() => { setEditing(null); reload(); }} onCancel={() => setEditing(null)} />}
      {isOpen && (
        <div className="ml-5 mt-2">
          {children.length > 0 && (
            <ul>{children.map(ch => <Row key={ch.id} c={ch} all={all} open={open} toggle={toggle} editing={editing} setEditing={setEditing} reload={reload} />)}</ul>
          )}
          {c.depth < 2 && c.kind !== 'zodiac' && c.kind !== 'pawsonality' && <AddChild parent={c} onAdded={reload} />}
        </div>
      )}
    </li>
  );
}

function ThemeMapping({ themes, collections, reload }: { themes: Theme[]; collections: Collection[]; reload: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const byId = useMemo(() => new Map(collections.map(c => [c.id, c])), [collections]);
  const label = (c: Collection) => c.path.split('/').map((_, i, parts) => collections.find(x => x.path === parts.slice(0, i + 1).join('/'))?.name ?? '').join(' › ');
  const options = useMemo(() => {
    const out: Collection[] = [];
    const walk = (pid: string | null) => collections.filter(c => c.parent_id === pid).sort((a, b) => a.sort_order - b.sort_order).forEach(c => { out.push(c); walk(c.id); });
    walk(null);
    return out;
  }, [collections]);

  const set = async (t: Theme, id: string | null) => {
    setBusy(t.id); setNotice(null);
    const r = await new AdminSupabaseService().setThemeCollection(t.id, id);
    setBusy(null);
    if (r.ok) { setNotice(id ? `${t.name}: ${r.data?.added ?? 0} design${r.data?.added === 1 ? '' : 's'} filed in ${byId.get(id)?.name}` : `${t.name} no longer files its designs anywhere`); reload(); }
    else setNotice(r.error || 'Could not save');
  };
  const refile = async () => {
    setBusy('all'); setNotice(null);
    const r = await new AdminSupabaseService().refileThemeCollections();
    setBusy(null);
    setNotice(r.ok ? `Re-filed: ${r.data?.added ?? 0} designs added` : r.error || 'Could not re-file');
    reload();
  };
  const suggestions = themes.filter(t => !t.default_collection_id && t.suggested_collection_id);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">
        Themes are now behind the scenes: they’re how designs get made. Point a theme at a collection and all its designs, including new ones, appear there. A theme with no collection is fine; its designs are still found by breed and search.
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestions.length > 0 && (
          <button disabled={!!busy} onClick={async () => { for (const t of suggestions) await set(t, t.suggested_collection_id); }} className="flex items-center gap-1 rounded bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50">
            <Sparkles className="h-4 w-4" /> Use {suggestions.length} suggestion{suggestions.length === 1 ? '' : 's'} from theme names
          </button>
        )}
        <button disabled={!!busy} onClick={refile} className="flex items-center gap-1 rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${busy === 'all' ? 'animate-spin' : ''}`} /> Re-file all designs
        </button>
      </div>
      {notice && <p role="status" className="text-sm text-gray-800">{notice}</p>}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-700">
            <tr><th className="px-4 py-2 font-semibold">Theme</th><th className="px-4 py-2 font-semibold">Designs</th><th className="px-4 py-2 font-semibold">Files its designs in</th></tr>
          </thead>
          <tbody>
            {themes.map(t => (
              <tr key={t.id} className="border-t border-gray-100">
                <td className="px-4 py-2 font-medium text-gray-900">{t.name}{!t.is_active && <span className="ml-2 text-xs text-gray-500">(off)</span>}</td>
                <td className="px-4 py-2 text-gray-800">{t.designs}</td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <select aria-label={`Collection for ${t.name}`} disabled={busy === t.id} value={t.default_collection_id ?? ''} onChange={e => set(t, e.target.value || null)} className="max-w-xs rounded border border-gray-300 px-2 py-1.5 text-sm">
                      <option value="">No collection</option>
                      {options.map(c => <option key={c.id} value={c.id}>{'  '.repeat(c.depth)}{c.name}</option>)}
                    </select>
                    {!t.default_collection_id && t.suggested_collection_id && byId.get(t.suggested_collection_id) && (
                      <button onClick={() => set(t, t.suggested_collection_id)} className="text-xs font-medium text-purple-700 hover:underline">Suggested: {label(byId.get(t.suggested_collection_id)!)}</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!themes.length && <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-600">No themes yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminCollectionsPage() {
  const [data, setData] = useState<{ collections: Collection[]; themes: Theme[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'collections' | 'themes' | 'tagging'>('collections');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await new AdminSupabaseService().getCollections();
    if (r.ok) { setData(r.data); setError(null); } else setError(r.error || 'Could not load collections');
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) => setOpen(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const top = (data?.collections ?? []).filter(c => !c.parent_id).sort((a, b) => a.sort_order - b.sort_order);
  const inSeasonNow = (data?.collections ?? []).filter(c => c.in_season).map(c => c.name);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Collections</h1>
        <p className="mt-1 text-gray-700">Besides breed, the places customers browse: Occasions, Sports, 16 Pawsonalities and Zodiac signs.</p>
        {inSeasonNow.length > 0 && <p className="mt-2 text-sm text-green-800">Promoted right now: {inSeasonNow.join(', ')}</p>}
      </div>
      <div role="tablist" className="flex gap-1 border-b border-gray-200">
        {(['collections', 'themes', 'tagging'] as const).map(t => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${tab === t ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-700 hover:text-gray-900'}`}>
            {t === 'collections' ? 'Collections' : t === 'themes' ? 'Themes → collections' : 'Tagging'}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {!data && !error && <p className="text-gray-700">Loading…</p>}
      {data && tab === 'collections' && (
        <ul className="space-y-3">
          {top.map(c => <Row key={c.id} c={c} all={data.collections} open={open} toggle={toggle} editing={editing} setEditing={setEditing} reload={load} />)}
          {!top.length && <li className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">No collections yet. Run db/migrations/2026-10-07-collections-seed.sql.</li>}
        </ul>
      )}
      {data && tab === 'tagging' && <TaggingTab collections={data.collections} />}
      {data && tab === 'themes' && <ThemeMapping themes={data.themes} collections={data.collections} reload={load} />}
    </div>
  );
}
