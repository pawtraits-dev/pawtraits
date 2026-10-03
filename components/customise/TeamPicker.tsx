'use client';

/**
 * Team switcher on a sports design (docs/specs/collections-plan.md, phase 4).
 * Shows the design's team; "Change team" opens a searchable list (name or nickname, grouped by
 * league). Picking a ready team opens that version's design page straight away; any other team
 * is painted on the spot (20–60 s, with a progress overlay) and then opened. "Add my pet's
 * photo" and buying on that page then use the team version.
 * Data: GET/POST /api/public/designs/[id]/teams.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Search, X } from 'lucide-react';

interface Team { path: string; name: string; short: string; nicknames: string[]; colours: { name: string; hex: string }[]; ready: boolean; imageId: string | null }
interface Data { switchable: boolean; sourceId?: string; current?: { path: string; name: string; short: string; colours: Team['colours'] } | null; groups: { league: string; name: string; teams: Team[] }[] }

const POLL_MS = 3000;
const POLL_FOR_MS = 150_000;

function Swatches({ colours, size = 'md' }: { colours: Team['colours']; size?: 'sm' | 'md' }) {
  return (
    <span className="flex flex-none overflow-hidden rounded border border-gray-300" aria-hidden>
      {colours.slice(0, 3).map(c => <span key={c.hex} className={size === 'sm' ? 'h-4 w-3' : 'h-5 w-4'} style={{ background: c.hex }} />)}
    </span>
  );
}

export default function TeamPicker({ imageId }: { imageId: string }) {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [painting, setPainting] = useState<Team | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    let stop = false;
    setData(null);
    fetch(`/api/public/designs/${imageId}/teams`).then(r => (r.ok ? r.json() : null)).then(d => !stop && setData(d)).catch(() => {});
    return () => { stop = true; cancelled.current = true; };
  }, [imageId]);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !painting) close(); };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [open, painting]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!data?.groups) return [];
    if (!n) return data.groups;
    return data.groups.map(g => ({ ...g, teams: g.teams.filter(t => [t.name, t.short, ...t.nicknames].some(x => x.toLowerCase().includes(n))) })).filter(g => g.teams.length);
  }, [data, q]);

  if (!data?.switchable) return null;

  const close = () => { setOpen(false); setQ(''); setMessage(null); triggerRef.current?.focus(); };

  const go = (target: string) => {
    const from = new URLSearchParams(window.location.search).get('from');
    router.push(`/customise/${target}${from ? `?from=${encodeURIComponent(from)}` : ''}`);
  };

  const pick = async (team: Team) => {
    setMessage(null);
    if (team.path === data.current?.path) { close(); return; }
    if (team.ready && team.imageId) { go(team.imageId); return; }
    setPainting(team);
    cancelled.current = false;
    const post = async (peek: boolean) => {
      const r = await fetch(`/api/public/designs/${imageId}/teams`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ team: team.path, peek }) });
      return r.ok ? r.json() : { status: 'failed' };
    };
    try {
      let res = await post(false);
      const started = Date.now();
      while (res.status === 'pending' && !cancelled.current && Date.now() - started < POLL_FOR_MS) {
        await new Promise(r => setTimeout(r, POLL_MS));
        res = await post(true);
      }
      if (cancelled.current) return;
      if (res.status === 'done' && res.imageId) { go(res.imageId); return; }
      setMessage(res.status === 'unavailable' && res.reason === 'busy'
        ? 'You’ve painted lots of teams this hour. Teams marked Ready still work, or try again a little later.'
        : res.status === 'pending'
          ? `${team.short} is still being painted. Give it a minute and pick it again.`
          : `We couldn’t paint ${team.short} just now. Try another team, or try again later.`);
    } catch {
      setMessage('Something went wrong. Please try again.');
    } finally {
      setPainting(null);
    }
  };

  return (
    <section className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3" aria-label="Team">
      {data.current ? (
        <span className="flex min-w-0 flex-1 items-center gap-2 text-sm text-gray-900">
          <Swatches colours={data.current.colours} />
          <span className="truncate"><span className="text-gray-600">Team:</span> <strong>{data.current.name}</strong></span>
        </span>
      ) : (
        <span className="flex-1 text-sm text-gray-900">Make it <strong>your team</strong></span>
      )}
      <button ref={triggerRef} onClick={() => setOpen(true)} aria-haspopup="dialog"
        className="h-10 rounded-xl border-2 border-purple-200 px-4 text-sm font-semibold text-purple-800 hover:border-purple-400">
        Change team
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center" onClick={() => !painting && close()}>
          <div role="dialog" aria-modal="true" aria-labelledby="team-picker-title" onClick={e => e.stopPropagation()}
            className="flex h-[88dvh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:h-[80vh] sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h2 id="team-picker-title" className="text-lg font-bold text-gray-900">Choose your team</h2>
              <button onClick={close} disabled={!!painting} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100 disabled:opacity-40"><X className="h-5 w-5" /></button>
            </div>

            {painting ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center" role="status" aria-live="polite">
                <div className="flex gap-1.5" aria-hidden>
                  {painting.colours.slice(0, 3).map((c, i) => (
                    <span key={c.hex} className="h-6 w-6 animate-bounce rounded-full border border-gray-300" style={{ background: c.hex, animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
                <p className="text-lg font-semibold text-gray-900">Painting it in {painting.short} colours…</p>
                <p className="text-sm text-gray-600">This takes about a minute the first time. Once it’s done it’s ready for everyone.</p>
              </div>
            ) : (
              <>
                <div className="px-4 pt-3">
                  <label className="relative block">
                    <span className="sr-only">Find a team</span>
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" aria-hidden />
                    <input ref={searchRef} type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Team name or nickname"
                      className="h-11 w-full rounded-xl border border-gray-300 pl-9 pr-3 text-base focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200" />
                  </label>
                  {message && <p role="alert" className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">{message}</p>}
                </div>
                <div className="flex-1 overflow-y-auto px-2 pb-4 pt-2">
                  {groups.length === 0 && <p className="px-2 py-6 text-center text-sm text-gray-600">No team matches “{q}”.</p>}
                  {groups.map(g => (
                    <div key={g.league} className="mt-2">
                      <p className="sticky top-0 bg-white px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-600">{g.name}</p>
                      <ul>
                        {g.teams.map(t => {
                          const current = t.path === data.current?.path;
                          return (
                            <li key={t.path}>
                              <button onClick={() => pick(t)} aria-current={current ? 'true' : undefined}
                                className={`flex min-h-[48px] w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-purple-50 ${current ? 'bg-purple-50' : ''}`}>
                                <Swatches colours={t.colours} size="sm" />
                                <span className="flex-1 text-sm text-gray-900">{t.name}</span>
                                {current ? <Check className="h-4 w-4 text-purple-700" aria-label="Current team" />
                                  : t.ready ? <span className="rounded bg-green-100 px-1.5 py-0.5 text-[11px] font-semibold text-green-800">Ready</span> : null}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
                <p className="border-t border-gray-200 px-4 py-2 text-xs text-gray-600">Teams marked Ready open instantly; others are painted for you in about a minute. Colours only, no club badges.</p>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
