'use client';

/**
 * Admin → Collections → Team versions (phase 4). Every sports design, which teams it offers
 * (its league / any team / off) and how many team versions exist. Open a design to see each
 * team's version, make one, or "Make all missing" (one at a time, about a minute each; Stop any
 * time). Versions are made once and then open instantly for every customer.
 * Data: /api/admin/collections/team-versions* via AdminSupabaseService.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, ChevronRight, RefreshCw, Shirt, Sparkles } from 'lucide-react';
import { AdminSupabaseService } from '@/lib/admin-supabase';

interface Row { id: string; title: string; thumb: string; home: { path: string; name: string; isTeam: boolean }; league: string; scope: 'league' | 'any' | 'off'; offered: number; made: number; failed: number; isPublic: boolean }
interface Team { path: string; name: string; short: string; colours: { name: string; hex: string }[]; status: 'ready' | 'running' | 'failed' | 'none'; imageId: string | null; thumb: string | null; error: string | null; check: KitCheck | null; description: string | null; published: boolean }
interface KitCheck { name: string | null; number: number | null; logos: boolean; ok: boolean }
interface Kit { name: string; number: number | null; scene: boolean; slogan?: boolean }
interface KitTest { id?: string; design_id: string; kit_name: string; kit_number: number | null; image_url: string | null; thumb?: string | null; read_name: string | null; read_number: number | null; logos: boolean | null; matches: boolean | null; error: string | null; duration_ms: number | null; created_at?: string }
interface Detail { scope: string; home: string | null; sourceId: string; kit: Kit | null; tests: KitTest[]; groups: { league: string; name: string; teams: Team[] }[] }

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
  const [editing, setEditing] = useState<string | null>(null);   // team path whose description is open
  const [draft, setDraft] = useState('');

  const load = useCallback(async () => {
    const r = await svc().getTeamVersions(row.id);
    if (r.ok) setDetail(r.data); else setError(r.error);
  }, [row.id]);
  useEffect(() => { if (open) load(); }, [open, load]);

  const make = async (t: Team, redo = false) => {
    setBusy(t.path); setError(null);
    const r = await svc().makeTeamVersion(row.id, t.path, redo);
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

  const act = async (t: Team, action: 'publish' | 'unpublish' | 'describe' | 'save-description', description?: string) => {
    setBusy(t.path); setError(null);
    const r = await svc().teamVersionAction(row.id, t.path, action, description);
    setBusy(null);
    if (!r.ok) setError(`${t.short}: ${r.error}`);
    else if (r.data.description && editing === t.path) setDraft(r.data.description);
    await load();
  };

  /** Publish every ready version, writing a description first where there isn't one */
  const publishAll = async () => {
    if (!detail) return;
    stop.current = false; setError(null);
    const todo = detail.groups.flatMap(g => g.teams).filter(t => t.status === 'ready' && t.path !== detail.home && (!t.published || !t.description));
    let n = 0;
    for (const t of todo) {
      if (stop.current) break;
      setBusy(t.path); setProgress(`${t.short}: ${t.description ? 'publishing' : 'writing the description'} (${++n} of ${todo.length})…`);
      if (!t.description) { const r = await svc().teamVersionAction(row.id, t.path, 'describe'); if (!r.ok) { setError(`${t.short}: ${r.error}`); continue; } }
      if (!t.published) { const r = await svc().teamVersionAction(row.id, t.path, 'publish'); if (!r.ok) setError(`${t.short}: ${r.error}`); }
    }
    setBusy(null); setProgress(`${n} published${stop.current ? ' (stopped)' : ''}.`);
    await load();
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
              <KitPanel rowId={row.id} detail={detail} reload={load} />
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {missing > 0 && !busy && (
                  <button onClick={makeAll} className="flex items-center gap-1 rounded bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700">
                    <Sparkles className="h-4 w-4" /> Make all missing ({missing}, about {missing} min)
                  </button>
                )}
                {(() => {
                  const n = detail.groups.flatMap(g => g.teams).filter(t => t.status === 'ready' && t.path !== detail.home && (!t.published || !t.description)).length;
                  return n > 0 && !busy ? (
                    <button onClick={publishAll} className="rounded border border-purple-300 px-3 py-2 text-sm font-semibold text-purple-800 hover:bg-purple-50">
                      Describe &amp; publish ready versions ({n})
                    </button>
                  ) : null;
                })()}
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
                        {t.check && busy !== t.path && (
                          <p className={`flex items-center gap-0.5 text-[11px] ${t.check.ok ? 'text-green-700' : 'text-red-700'}`} title="What the shirt reads (checked automatically)">
                            {t.check.ok ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                            {t.check.ok ? `${t.check.name ?? ''} ${t.check.number ?? ''}` : `reads ${t.check.name ?? '?'} ${t.check.number ?? ''}${t.check.logos ? ' · logo' : ''}`}
                          </p>
                        )}
                        {t.status === 'ready' && t.path !== detail.home && !busy && (
                          <button onClick={() => make(t, true)} className="mt-1 flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-purple-700 hover:underline">
                            <RefreshCw className="h-3 w-3" /> Redo
                          </button>
                        )}
                        {t.status === 'ready' && t.path !== detail.home && (
                          <div className="mt-1 space-y-0.5 border-t border-gray-200 pt-1 text-[11px]">
                            <p className={t.published ? 'font-medium text-green-700' : 'text-gray-500'}>{t.published ? 'On the team page' : 'Not published'}</p>
                            <button onClick={() => { setEditing(editing === t.path ? null : t.path); setDraft(t.description ?? ''); }} className="block max-w-full truncate text-left text-purple-700 hover:underline" title={t.description ?? ''}>
                              {t.description ? (/\*\*(.+?)\*\*/.exec(t.description)?.[1] ?? 'Description') : 'No description yet'}
                            </button>
                            {!busy && (
                              <button onClick={() => act(t, t.published ? 'unpublish' : 'publish')} className="text-gray-600 hover:text-purple-700 hover:underline">
                                {t.published ? 'Unpublish' : 'Publish'}
                              </button>
                            )}
                          </div>
                        )}
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
              {editing && (() => {
                const t = detail.groups.flatMap(g => g.teams).find(x => x.path === editing);
                if (!t) return null;
                return (
                  <div className="mt-2 rounded-lg border border-purple-200 bg-white p-3">
                    <p className="text-sm font-semibold text-gray-900">{t.short} version: title and description</p>
                    <p className="text-xs text-gray-600">Bold the title with **double asterisks** on the first line. Customers see this on the design page.</p>
                    <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={6} className="mt-2 w-full rounded border border-gray-300 p-2 text-sm" />
                    <div className="mt-2 flex flex-wrap gap-2 text-sm">
                      <button disabled={!!busy || !draft.trim()} onClick={() => act(t, 'save-description', draft)} className="rounded bg-purple-600 px-3 py-1.5 font-semibold text-white hover:bg-purple-700 disabled:opacity-50">Save</button>
                      <button disabled={!!busy} onClick={() => act(t, 'describe')} className="rounded border border-purple-300 px-3 py-1.5 font-medium text-purple-800 hover:bg-purple-50 disabled:opacity-50">{busy === t.path ? 'Writing…' : 'Write a new one'}</button>
                      <button onClick={() => setEditing(null)} className="rounded border border-gray-300 px-3 py-1.5">Close</button>
                    </div>
                  </div>
                );
              })()}
            </>
          )}
          {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
        </div>
      )}
    </li>
  );
}

/** Personalised kit: name and number on the pet's shirt, whole-scene team switch, lettering tests */
function KitPanel({ rowId, detail, reload }: { rowId: string; detail: Detail; reload: () => Promise<void> | void }) {
  const kit = detail.kit;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: kit?.name ?? '', number: kit?.number?.toString() ?? '', scene: kit?.scene ?? true, slogan: kit?.slogan ?? false });
  const [test, setTest] = useState({ name: 'MAX', number: '4', team: '' });
  const [running, setRunning] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const svc = () => new AdminSupabaseService();
  const ready = detail.groups.flatMap(g => g.teams).filter(t => t.status === 'ready' && t.path !== detail.home);
  const num = (v: string) => (v.trim() === '' ? null : Number(v));

  const save = async (off = false) => {
    setMsg(null);
    const r = await svc().setKitPersonalisation(rowId, off ? null : { name: form.name, number: num(form.number), scene: form.scene, slogan: form.slogan });
    if (!r.ok) { setMsg(r.error); return; }
    setEditing(false);
    await reload();
  };

  const runTests = async (list: { name: string; number: number | null }[], team: string) => {
    setMsg(null);
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      setRunning(`Painting ${t.name}${t.number === null ? '' : ` ${t.number}`}${list.length > 1 ? ` (${i + 1} of ${list.length})` : ''}… about a minute`);
      const r = await svc().testKitLettering(rowId, t.name, t.number, team || null);
      if (!r.ok) setMsg(r.error);
      await reload();
    }
    setRunning(null);
  };

  return (
    <div className="mb-4 rounded-lg border border-purple-100 bg-purple-50/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Shirt className="h-4 w-4 text-purple-700" />
        <p className="text-sm font-semibold text-gray-900">Personalised kit</p>
        {kit && !editing && (
          <>
            <span className="text-sm text-gray-700">Shirt reads <strong>{kit.name}{kit.number === null ? '' : ` ${kit.number}`}</strong> · {kit.scene ? 'team switch recolours players and fans too' : 'team switch recolours the pet only'}{kit.slogan ? ' · shows the team motto' : ''}</span>
            <button onClick={() => { setForm({ name: kit.name, number: kit.number?.toString() ?? '', scene: kit.scene, slogan: !!kit.slogan }); setEditing(true); }} className="text-sm text-purple-700 hover:underline">Edit</button>
            <button onClick={() => save(true)} className="text-sm text-gray-500 hover:underline">Turn off</button>
          </>
        )}
        {!kit && !editing && (
          <button onClick={() => setEditing(true)} className="text-sm text-purple-700 hover:underline">The pet&apos;s shirt has a name and number: set it up</button>
        )}
      </div>

      {editing && (
        <div className="mt-2 flex flex-wrap items-end gap-3 text-sm">
          <label className="block">Name on the design
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value.toUpperCase() }))} maxLength={12} className="mt-0.5 block w-36 rounded border border-gray-300 px-2 py-1 uppercase" />
          </label>
          <label className="block">Number
            <input value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value.replace(/\D/g, '').slice(0, 2) }))} inputMode="numeric" className="mt-0.5 block w-16 rounded border border-gray-300 px-2 py-1" />
          </label>
          <label className="flex items-center gap-2 pb-1">
            <input type="checkbox" checked={form.scene} onChange={e => setForm(f => ({ ...f, scene: e.target.checked }))} />
            Team switch recolours the players and fans too
          </label>
          <label className="flex items-center gap-2 pb-1">
            <input type="checkbox" checked={form.slogan} onChange={e => setForm(f => ({ ...f, slogan: e.target.checked }))} />
            Show the team motto as big text on the right (customers can write their own)
          </label>
          <button onClick={() => save()} className="rounded bg-purple-600 px-3 py-1.5 font-semibold text-white hover:bg-purple-700">Save</button>
          <button onClick={() => setEditing(false)} className="rounded border border-gray-300 px-3 py-1.5">Cancel</button>
          <p className="basis-full text-xs text-gray-600">Team versions made before this was set up used the pet-only recolour: use Redo on them.</p>
        </div>
      )}

      {kit && (
        <div className="mt-3 border-t border-purple-100 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Lettering tests</p>
          <p className="text-xs text-gray-600">Paints another name and number onto the design (or a team version) and reads the shirt back to check the spelling. About a minute and ~13p each.</p>
          <div className="mt-2 flex flex-wrap items-end gap-2 text-sm">
            <input value={test.name} onChange={e => setTest(t => ({ ...t, name: e.target.value.toUpperCase() }))} maxLength={12} aria-label="Test name" className="w-36 rounded border border-gray-300 px-2 py-1 uppercase" />
            <input value={test.number} onChange={e => setTest(t => ({ ...t, number: e.target.value.replace(/\D/g, '').slice(0, 2) }))} aria-label="Test number" placeholder="No." className="w-16 rounded border border-gray-300 px-2 py-1" />
            <select value={test.team} onChange={e => setTest(t => ({ ...t, team: e.target.value }))} aria-label="Paint on" className="rounded border border-gray-300 px-2 py-1">
              <option value="">On the original</option>
              {ready.map(t => <option key={t.path} value={t.path}>On the {t.short} version</option>)}
            </select>
            <button disabled={!!running} onClick={() => runTests([{ name: test.name, number: num(test.number) }], test.team)} className="rounded bg-purple-600 px-3 py-1.5 font-semibold text-white hover:bg-purple-700 disabled:opacity-50">Paint test</button>
            <button disabled={!!running} onClick={() => runTests([{ name: 'MAX', number: 4 }, { name: 'BISCUIT', number: 10 }, { name: 'WELLINGTON', number: 99 }], test.team)} className="rounded border border-purple-300 px-3 py-1.5 font-medium text-purple-800 hover:bg-purple-50 disabled:opacity-50">Run the 3 standard tests</button>
          </div>
          {running && <p role="status" className="mt-2 text-sm text-gray-800">{running}</p>}
          {detail.tests.length > 0 && (
            <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {detail.tests.map((t, i) => (
                <li key={t.id ?? i} className={`rounded-lg border p-2 ${t.error ? 'border-red-200 bg-red-50' : t.matches ? 'border-green-200 bg-white' : 'border-amber-300 bg-amber-50'}`}>
                  {t.image_url ? (
                    <a href={t.image_url} target="_blank" rel="noreferrer" className="block aspect-[4/5] overflow-hidden rounded bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={t.thumb ?? t.image_url} alt={`${t.kit_name} test`} className="h-full w-full object-cover" loading="lazy" />
                    </a>
                  ) : <div className="flex aspect-[4/5] items-center justify-center rounded bg-gray-100 text-xs text-red-700">Failed</div>}
                  <p className="mt-1 text-xs font-semibold text-gray-900">{t.kit_name}{t.kit_number === null ? '' : ` ${t.kit_number}`}{t.design_id !== detail.sourceId ? <span className="font-normal text-gray-500"> · team version</span> : null}</p>
                  {t.error
                    ? <p className="text-[11px] text-red-700" title={t.error}>{t.error.slice(0, 60)}</p>
                    : <p className={`flex items-center gap-0.5 text-[11px] ${t.matches ? 'text-green-700' : 'text-amber-800'}`}>
                        {t.matches ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                        reads {t.read_name ?? '?'}{t.read_number === null ? '' : ` ${t.read_number}`}{t.logos ? ' · logo seen' : ''}
                      </p>}
                </li>
              ))}
            </ul>
          )}
          {msg && <p role="alert" className="mt-2 text-sm text-red-700">{msg}</p>}
        </div>
      )}
      {!kit && msg && <p role="alert" className="mt-2 text-sm text-red-700">{msg}</p>}
    </div>
  );
}

/** The big text on personalised-kit designs: each team's motto, editable */
function TeamMottos() {
  const [open, setOpen] = useState(false);
  const [teams, setTeams] = useState<{ path: string; name: string; motto: string | null; default: string | null }[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!open || teams) return;
    new AdminSupabaseService().getTeamMottos().then(r => {
      if (!r.ok) { setErr(r.error); return; }
      setTeams(r.data.teams);
      setDrafts(Object.fromEntries(r.data.teams.map(t => [t.path, t.motto ?? t.default ?? ''])));
    });
  }, [open, teams]);
  const save = async (path: string, value: string | null) => {
    setErr(null); setSaved(null);
    const r = await new AdminSupabaseService().setTeamMotto(path, value);
    if (!r.ok) { setErr(r.error); return; }
    const t = teams?.find(x => x.path === path);
    setTeams(ts => ts?.map(x => (x.path === path ? { ...x, motto: r.data.motto } : x)) ?? null);
    setDrafts(d => ({ ...d, [path]: r.data.motto ?? t?.default ?? '' }));
    setSaved(path);
  };
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1 font-semibold text-gray-900">
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />} Team mottos
      </button>
      <p className="mt-1 text-gray-600">The big words on the right half of the mug wrap (designs with “Show the team motto” ticked). Stack short lines like a poster: press Enter for a new line, about 9 capitals per line at most (longer lines wrap). Up to 32 characters.</p>
      {open && !teams && !err && <p className="mt-2 text-gray-600">Loading…</p>}
      {open && teams && (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map(t => {
            const value = drafts[t.path] ?? '';
            const changed = value !== (t.motto ?? t.default ?? '');
            return (
              <li key={t.path} className="rounded border border-gray-200 p-2">
                <p className="text-xs font-semibold text-gray-900">{t.name}</p>
                <textarea value={value} rows={3} onChange={e => setDrafts(d => ({ ...d, [t.path]: e.target.value.toUpperCase() }))}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm font-semibold uppercase leading-tight" aria-label={`${t.name} motto`} />
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  {changed && <button onClick={() => save(t.path, value)} className="rounded bg-purple-600 px-2 py-1 font-semibold text-white">Save</button>}
                  {t.motto && t.default && t.motto !== t.default && <button onClick={() => save(t.path, null)} className="text-gray-600 hover:underline">Back to default</button>}
                  {saved === t.path && !changed && <span className="text-green-700">Saved</span>}
                  {!t.motto && !t.default && <span className="text-gray-500">No motto yet</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {err && <p role="alert" className="mt-2 text-red-700">{err}</p>}
    </div>
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
      <TeamMottos />
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
