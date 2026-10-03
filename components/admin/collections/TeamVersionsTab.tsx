'use client';

/**
 * Admin → Collections → Team versions (phase 4). Every sports design, which teams it offers
 * (its league / any team / off) and how many team versions exist. Open a design to see each
 * team's version, make one, or "Make all missing" (one at a time, about a minute each; Stop any
 * time). Versions are made once and then open instantly for every customer.
 * Data: /api/admin/collections/team-versions* via AdminSupabaseService.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, RefreshCw, Sparkles } from 'lucide-react';
import { AdminSupabaseService } from '@/lib/admin-supabase';

interface Row { id: string; title: string; thumb: string; home: { path: string; name: string; isTeam: boolean }; league: string; scope: 'league' | 'any' | 'off'; offered: number; made: number; failed: number; isPublic: boolean }
interface Team { path: string; name: string; short: string; colours: { name: string; hex: string }[]; status: 'ready' | 'running' | 'failed' | 'none'; imageId: string | null; thumb: string | null; error: string | null }
interface Detail { scope: string; home: string | null; groups: { league: string; name: string; teams: Team[] }[] }

const STATUS: Record<Team['status'], { label: string; cls: string }> = {
  ready: { label: 'Ready', cls: 'border-green-300 bg-green-50' },
  running: { label: 'Painting…', cls: 'border-amber-300 bg-amber-50' },
  failed: { label: 'Failed', cls: 'border-red-300 bg-red-50' },
  none: { label: 'Not made', cls: 'border-gray-200 bg-white' },
};

function DesignRow({ row, onChanged }: { row: Row; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stop = useRef(false);
  const svc = () => new AdminSupabaseService();

  const load = useCallback(async () => {
    const r = await svc().getTeamVersions(row.id);
    if (r.ok) setDetail(r.data); else setError(r.error);
  }, [row.id]);
  useEffect(() => { if (open) load(); }, [open, load]);

  const make = async (t: Team) => {
    setBusy(t.path); setError(null);
    const r = await svc().makeTeamVersion(row.id, t.path);
    setBusy(null);
    if (!r.ok) setError(r.error);
    else if (r.data.status === 'failed') setError(`${t.short}: ${r.data.error || 'failed'}`);
    await load();
  };

  const makeAll = async () => {
    if (!detail) return;
    stop.current = false; setError(null);
    const todo = detail.groups.flatMap(g => g.teams).filter(t => t.status === 'none' || t.status === 'failed');
    let done = 0, failed = 0;
    for (const t of todo) {
      if (stop.current) break;
      setBusy(t.path); setProgress(`Painting ${t.short} (${done + failed + 1} of ${todo.length})…`);
      const r = await svc().makeTeamVersion(row.id, t.path);
      if (r.ok && r.data.status === 'done') done++; else failed++;
      await load();
    }
    setBusy(null);
    setProgress(`${done} made${failed ? `, ${failed} failed` : ''}${stop.current ? ' (stopped)' : ''}.`);
    onChanged();
  };

  const setScope = async (scope: Row['scope']) => {
    const r = await svc().setTeamSwitch(row.id, scope);
    if (!r.ok) setError(r.error);
    onChanged();
    if (open) load();
  };

  const missing = detail ? detail.groups.flatMap(g => g.teams).filter(t => t.status === 'none' || t.status === 'failed').length : row.offered - row.made;

  return (
    <li className="rounded-lg border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center gap-3 p-3">
        <button onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label={`${open ? 'Close' : 'Open'} ${row.title}`} className="rounded p-1 text-gray-600 hover:bg-gray-100">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={row.thumb} alt="" className="h-14 w-14 rounded object-cover" loading="lazy" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-gray-900">{row.title}</p>
          <p className="text-xs text-gray-600">{row.home.isTeam ? row.home.name : `${row.home.name} (no team set)`}{!row.isPublic && ' · hidden'}</p>
        </div>
        <label className="text-sm text-gray-700">
          <span className="sr-only">Teams offered for {row.title}</span>
          <select value={row.scope} onChange={e => setScope(e.target.value as Row['scope'])} className="rounded border border-gray-300 px-2 py-1.5 text-sm">
            <option value="league">Its league</option>
            <option value="any">Any team</option>
            <option value="off">No switching</option>
          </select>
        </label>
        <span className={`text-sm ${row.scope === 'off' ? 'text-gray-500' : 'text-gray-800'}`}>{row.scope === 'off' ? 'Off' : `${row.made} of ${row.offered} ready`}{row.failed ? <span className="text-red-700"> · {row.failed} failed</span> : null}</span>
      </div>
      {open && (
        <div className="border-t border-gray-100 p-3">
          {!detail && !error && <p className="text-sm text-gray-600">Loading…</p>}
          {detail && detail.groups.length === 0 && <p className="text-sm text-gray-600">Team switching is off for this design.</p>}
          {detail && detail.groups.length > 0 && (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {missing > 0 && !busy && (
                  <button onClick={makeAll} className="flex items-center gap-1 rounded bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700">
                    <Sparkles className="h-4 w-4" /> Make all missing ({missing}, about {missing} min)
                  </button>
                )}
                {busy && progress && <button onClick={() => { stop.current = true; }} className="rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800">Stop after this one</button>}
                {progress && <p role="status" className="text-sm text-gray-800">{progress}</p>}
              </div>
              {detail.groups.map(g => (
                <div key={g.league} className="mb-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-600">{g.name}</p>
                  <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                    {g.teams.map(t => (
                      <li key={t.path} className={`rounded-lg border p-2 ${STATUS[busy === t.path ? 'running' : t.status].cls}`}>
                        <div className="aspect-[4/5] overflow-hidden rounded bg-gray-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {t.thumb ? <img src={t.thumb} alt={`${t.short} version`} className="h-full w-full object-cover" loading="lazy" /> : (
                            <div className="flex h-full items-center justify-center gap-0.5" aria-hidden>{t.colours.slice(0, 3).map(c => <span key={c.hex} className="h-6 w-4 rounded-sm border border-gray-300" style={{ background: c.hex }} />)}</div>
                          )}
                        </div>
                        <p className="mt-1 truncate text-xs font-semibold text-gray-900" title={t.name}>{t.short}{t.path === detail.home ? ' (original)' : ''}</p>
                        <p className="text-[11px] text-gray-700" title={t.error ?? undefined}>{busy === t.path ? 'Painting…' : STATUS[t.status].label}</p>
                        {(t.status === 'none' || t.status === 'failed') && !busy && (
                          <button onClick={() => make(t)} className="mt-1 flex items-center gap-1 text-xs font-medium text-purple-700 hover:underline">
                            <RefreshCw className="h-3 w-3" /> {t.status === 'failed' ? 'Try again' : 'Make'}
                          </button>
                        )}
                        {t.imageId && t.path !== detail.home && <a href={`/customise/${t.imageId}`} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-purple-700 hover:underline">Open</a>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </>
          )}
          {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
        </div>
      )}
    </li>
  );
}

export default function TeamVersionsTab() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<{ total: number; page: number; pageSize: number; designs: Row[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [limit, setLimit] = useState<number | null>(null);

  const load = useCallback(async () => {
    const r = await new AdminSupabaseService().getTeamVersionDesigns(q, page);
    if (r.ok) { setData(r.data); setError(null); } else setError(r.error);
  }, [q, page]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    new AdminSupabaseService().getAppSettings().then(r => {
      setEnabled(r.ok ? r.data.team_switch_enabled?.value !== false : true);
      setLimit(r.ok ? Number(r.data.team_switch_hourly_limit?.value ?? 6) : 6);
    });
  }, []);
  const save = async (key: string, value: unknown) => {
    const r = await new AdminSupabaseService().updateAppSetting(key, value);
    if (!r.ok) setError(r.error);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-800">
        <p>On a sports design, customers can pick any team from its league (or any team at all, if you choose) and see the design in that team’s colours, then add their pet. Each version is painted once (about a minute) and then opens instantly for everyone, so make the popular ones in advance.</p>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={!!enabled} disabled={enabled === null} onChange={e => { setEnabled(e.target.checked); save('team_switch_enabled', e.target.checked); }} />
          <span className="font-medium">Customers can change the team</span>
        </label>
        <label className="flex flex-wrap items-center gap-2">
          New versions one visitor can have painted per hour
          <input type="number" min={0} max={100} value={limit ?? ''} onChange={e => setLimit(Number(e.target.value))} onBlur={() => limit !== null && save('team_switch_hourly_limit', Math.max(0, Math.min(100, Math.round(limit))))}
            className="w-20 rounded border border-gray-300 px-2 py-1" aria-label="New versions per visitor per hour" />
          <span className="text-gray-600">(ready ones are unlimited; 0 = only ready ones)</span>
        </label>
      </div>
      <input type="search" value={q} onChange={e => { setQ(e.target.value); setPage(0); }} placeholder="Find a design or team" aria-label="Find a sports design" className="rounded border border-gray-300 px-3 py-1.5 text-sm" />
      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {!data && !error && <p className="text-sm text-gray-700">Loading…</p>}
      {data && data.designs.length === 0 && (
        <p className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-700">No sports designs yet. A design becomes a sports design when it’s filed under a team or league (auto-tagging does this for team kits, or add it in the Tagging tab).</p>
      )}
      {data && data.designs.length > 0 && (
        <>
          <ul className="space-y-2">{data.designs.map(d => <DesignRow key={d.id} row={d} onChanged={load} />)}</ul>
          {data.total > data.pageSize && (
            <div className="flex items-center justify-center gap-3 text-sm">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="rounded border border-gray-300 px-3 py-1.5 disabled:opacity-40">Previous</button>
              <span>Page {page + 1} of {Math.ceil(data.total / data.pageSize)}</span>
              <button disabled={(page + 1) * data.pageSize >= data.total} onClick={() => setPage(p => p + 1)} className="rounded border border-gray-300 px-3 py-1.5 disabled:opacity-40">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
