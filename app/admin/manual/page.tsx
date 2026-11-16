'use client';

/**
 * Admin -> Operating manual: today's checklist (daily, market day, weekly, monthly) and the full
 * manual (schedule, guides, troubleshooting, glossary). Content: lib/admin/manual/content.ts.
 * Ticks are shared and kept per day / week / month through /api/admin/manual/ticks. If the table
 * (db/migrations/2026-11-16-ops-checklist.sql) has not been added, ticks stay in this browser.
 */
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Check, ChevronDown, ChevronRight, Printer } from 'lucide-react';
import {
  GLOSSARY, GUIDES, ROUTINES, TROUBLESHOOTING,
  type Guide, type Routine, type RoutineId, type Task, type TickPeriod, type TroubleEntry, type Venue,
} from '@/lib/admin/manual/content';
import {
  WEEKDAY_NAMES, firstWorkingDay, isWeekday, isoWeekday, londonTime, londonToday, longDate, periodStartFor,
} from '@/lib/admin/manual/dates';

type Tick = { by: string | null; at: string | null };
type Market = 'none' | Venue;
type Section = 'schedule' | 'guides' | 'troubleshooting' | 'glossary';

const LOCAL_KEY = 'pt_manual_local_ticks';
const marketKey = (date: string) => `pt_manual_market_${date}`;
const tickId = (period: TickPeriod, start: string, key: string) => `${period}|${start}|${key}`;

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:ring-offset-2';

/** Renders **bold** labels. */
function Rich({ text }: { text: string }) {
  const parts = text.split('**');
  return (
    <>
      {parts.map((p, i) => (i % 2 === 1 ? <strong key={i} className="font-semibold text-gray-900">{p}</strong> : <Fragment key={i}>{p}</Fragment>))}
    </>
  );
}

function readLocal(): Record<string, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch { return {}; }
}
function writeLocal(v: Record<string, string>) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(v)); } catch { /* private mode */ }
}

export default function OperatingManualPage() {
  const [today, setToday] = useState<string | null>(null);
  const [market, setMarketState] = useState<Market | null>(null);
  const [ticks, setTicks] = useState<Record<string, Tick>>({});
  const [localMode, setLocalMode] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [section, setSection] = useState<Section>('schedule');
  const [printing, setPrinting] = useState(false);
  const [filter, setFilter] = useState('');

  // Today's date (London), and keep it right if the page is left open overnight
  useEffect(() => {
    setToday(londonToday());
    const onFocus = () => setToday(londonToday());
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  // Market-day answer, remembered for the day
  useEffect(() => {
    if (!today) return;
    let saved: string | null = null;
    try { saved = localStorage.getItem(marketKey(today)); } catch { /* private mode */ }
    setMarketState(saved === 'covent-garden' || saved === 'spitalfields' || saved === 'none' ? saved : null);
  }, [today]);
  const setMarket = (m: Market) => {
    setMarketState(m);
    if (today) { try { localStorage.setItem(marketKey(today), m); } catch { /* private mode */ } }
  };

  const loadLocal = useCallback((date: string) => {
    const local = readLocal();
    const next: Record<string, Tick> = {};
    Object.keys(local).forEach(k => { next[k] = { by: null, at: local[k] }; });
    setTicks(next);
    setLocalMode(true);
    void date;
  }, []);

  const load = useCallback(async (date: string) => {
    try {
      const r = await fetch(`/api/admin/manual/ticks?date=${date}`, { credentials: 'include', cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `Failed (${r.status})`);
      if (d.tableMissing) { loadLocal(date); setLoadError(false); return; }
      const next: Record<string, Tick> = {};
      (d.ticks as { task_key: string; period: TickPeriod; period_start: string; done_by_name: string | null; done_at: string | null }[]).forEach(t => {
        next[tickId(t.period, String(t.period_start).slice(0, 10), t.task_key)] = { by: t.done_by_name, at: t.done_at };
      });
      setTicks(next);
      setLocalMode(false);
      setLoadError(false);
    } catch {
      setLoadError(true);
      loadLocal(date);
    }
  }, [loadLocal]);

  useEffect(() => { if (today) load(today); }, [today, load]);

  const toggle = async (task: Task, period: TickPeriod, done: boolean) => {
    if (!today) return;
    const start = periodStartFor(period, today);
    const id = tickId(period, start, task.key);
    const applyLocal = () => {
      const local = readLocal();
      if (done) local[id] = new Date().toISOString(); else delete local[id];
      writeLocal(local);
      setTicks(prev => {
        const next = { ...prev };
        if (done) next[id] = { by: null, at: local[id] }; else delete next[id];
        return next;
      });
    };
    setMessage(null);
    if (localMode) { applyLocal(); return; }
    setBusyKey(id);
    try {
      const r = await fetch('/api/admin/manual/ticks', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: task.key, period, periodStart: start, done }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (d.tableMissing) { setLocalMode(true); applyLocal(); }
        else throw new Error(d.error || `Failed (${r.status})`);
      } else {
        setTicks(prev => {
          const next = { ...prev };
          if (done) next[id] = { by: d.tick?.done_by_name ?? null, at: d.tick?.done_at ?? new Date().toISOString() };
          else delete next[id];
          return next;
        });
      }
    } catch (e: any) {
      setMessage(`Could not save that tick: ${e.message}`);
    }
    setBusyKey(null);
  };

  const getTick = (task: Task, period: TickPeriod): Tick | undefined => (today ? ticks[tickId(period, periodStartFor(period, today), task.key)] : undefined);

  // ---- which routines apply today
  const routine = (id: RoutineId): Routine => ROUTINES.find(r => r.id === id)!;
  const venueTasks = (r: Routine) => r.tasks.filter(t => !t.venues || (market !== null && market !== 'none' && t.venues.includes(market)));
  const dayLists = useMemo(() => {
    if (!today) return [] as Routine[];
    const lists: Routine[] = [];
    if (isWeekday(today)) lists.push(routine('daily'));
    if (market && market !== 'none') lists.push(routine('market-before'), routine('market-at'), routine('market-after'));
    return lists.map(r => ({ ...r, tasks: venueTasks(r) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, market]);
  const dayTasks = dayLists.flatMap(r => r.tasks);
  const dayDone = dayTasks.filter(t => getTick(t, 'day')).length;

  const print = () => {
    setPrinting(true);
    const done = () => { setPrinting(false); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 150);
  };

  if (!today) return <p className="p-6 text-sm text-gray-600">Loading…</p>;

  const weekday = isoWeekday(today);
  const fwd = firstWorkingDay(today);
  const weekly = routine('weekly');
  const monthly = routine('monthly');
  const weeklyDone = weekly.tasks.filter(t => getTick(t, 'week')).length;
  const monthlyDone = monthly.tasks.filter(t => getTick(t, 'month')).length;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .manual-print, .manual-print * { visibility: visible !important; }
          .manual-print { position: absolute; left: 0; top: 0; width: 100%; padding: 0 12px; }
          .no-print { display: none !important; }
          .manual-print a { color: inherit; text-decoration: none; }
          .manual-print section, .manual-print li { break-inside: avoid; }
        }
      `}</style>

      <header className="no-print">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><BookOpen className="h-6 w-6 text-purple-600" aria-hidden /> Operating manual</h1>
        <p className="mt-1 text-sm text-gray-700">What to do each day, on market days, each week and each month, and how to do it with the admin pages.</p>
      </header>

      {/* ------------------------------------------------------------------ Today */}
      <section aria-labelledby="today-h" className="no-print space-y-5 rounded-xl border border-purple-200 bg-white p-4 md:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="today-h" className="text-lg font-semibold text-gray-900">Today</h2>
            <p className="text-sm text-gray-700">{longDate(today)}</p>
          </div>
          <p className="text-sm font-medium text-gray-900" role="status" aria-live="polite">
            {dayTasks.length ? `${dayDone} of ${dayTasks.length} done today` : 'Nothing on the daily list today'}
          </p>
        </div>

        {localMode && (
          <p className="text-xs text-gray-600">
            {loadError ? 'Could not reach the shared checklist, so ticks are saved on this device only. ' : 'Ticks are saved on this device only until the checklist table is added (db/migrations/2026-11-16-ops-checklist.sql).'}
          </p>
        )}
        {message && <p role="alert" className="text-sm text-red-700">{message}</p>}

        <fieldset className="rounded-lg bg-gray-50 p-3">
          <legend className="px-1 text-sm font-semibold text-gray-900">Is today a market day?</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-800">
            {([['covent-garden', 'Covent Garden'], ['spitalfields', 'Spitalfields'], ['none', 'No']] as [Market, string][]).map(([v, label]) => (
              <label key={v} className="flex items-center gap-2">
                <input type="radio" name="market-day" checked={market === v} onChange={() => setMarket(v)} className={`h-4 w-4 accent-purple-600 ${FOCUS}`} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        {!isWeekday(today) && <p className="text-sm text-gray-700">It is the weekend, so there is no daily list. Weekly and monthly jobs are below.</p>}

        {dayLists.map(r => (
          <div key={r.id}>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">{r.title}</h3>
            <ul className="space-y-2">
              {r.tasks.map(t => <TaskRow key={t.key} task={t} period="day" tick={getTick(t, 'day')} busy={busyKey === tickId('day', today, t.key)} onToggle={d => toggle(t, 'day', d)} localMode={localMode} printing={false} />)}
            </ul>
          </div>
        ))}

        <div>
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-700">Weekly</h3>
          <p className="mb-2 text-xs text-gray-600">{weeklyDone} of {weekly.tasks.length} done this week (the week starts on Monday).</p>
          <ul className="space-y-2">
            {[...weekly.tasks].sort((a, b) => (a.dueDay ?? 1) - (b.dueDay ?? 1)).map(t => {
              const due = t.dueDay ?? 1;
              const done = !!getTick(t, 'week');
              const note = done ? null : due === weekday ? { text: 'Due today', hot: true } : due < weekday ? { text: `Due ${WEEKDAY_NAMES[due - 1]}, still to do`, hot: true } : { text: `Due ${WEEKDAY_NAMES[due - 1]}`, hot: false };
              return <TaskRow key={t.key} task={t} period="week" tick={getTick(t, 'week')} busy={busyKey === tickId('week', periodStartFor('week', today), t.key)} onToggle={d => toggle(t, 'week', d)} localMode={localMode} printing={false} dueNote={note} />;
            })}
          </ul>
        </div>

        <div>
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-700">Monthly</h3>
          <p className="mb-2 text-xs text-gray-600">{monthlyDone} of {monthly.tasks.length} done this month. Due on the first working day: {longDate(fwd)}.</p>
          <ul className="space-y-2">
            {monthly.tasks.map(t => {
              const done = !!getTick(t, 'month');
              const note = done ? null : today >= fwd ? { text: 'Due now', hot: true } : { text: `Due ${longDate(fwd)}`, hot: false };
              return <TaskRow key={t.key} task={t} period="month" tick={getTick(t, 'month')} busy={busyKey === tickId('month', periodStartFor('month', today), t.key)} onToggle={d => toggle(t, 'month', d)} localMode={localMode} printing={false} dueNote={note} />;
            })}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------------------ The manual */}
      <section aria-labelledby="manual-h" className="space-y-4">
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <h2 id="manual-h" className="text-lg font-semibold text-gray-900">The manual</h2>
          <button type="button" onClick={print} className={`inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50 ${FOCUS}`}>
            <Printer className="h-4 w-4" aria-hidden /> Print this section
          </button>
        </div>

        <div role="tablist" aria-label="Manual sections" className="no-print flex flex-wrap gap-1 border-b border-gray-200">
          {([['schedule', 'Schedule'], ['guides', 'Guides'], ['troubleshooting', 'Troubleshooting'], ['glossary', 'Glossary']] as [Section, string][]).map(([k, label]) => (
            <button key={k} type="button" role="tab" id={`tab-${k}`} aria-selected={section === k} aria-controls={`panel-${k}`}
              onClick={() => setSection(k)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${FOCUS} ${section === k ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-700 hover:text-gray-900'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="manual-print" role="tabpanel" id={`panel-${section}`} aria-labelledby={`tab-${section}`}>
          {section === 'schedule' && <ScheduleView printing={printing} />}
          {section === 'guides' && <GuidesView filter={filter} setFilter={setFilter} printing={printing} />}
          {section === 'troubleshooting' && <TroubleshootingView />}
          {section === 'glossary' && <GlossaryView />}
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function RoleBadge({ role }: { role: Task['role'] }) {
  return role === 'owner'
    ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-900">Owner only</span>
    : null;
}

function Steps({ steps }: { steps: string[] }) {
  return (
    <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-800">
      {steps.map((s, i) => <li key={i}><Rich text={s} /></li>)}
    </ol>
  );
}

function OpenLink({ task }: { task: Task }) {
  return (
    <Link href={task.link.href} className={`no-print inline-flex items-center gap-1 rounded-lg border border-purple-300 bg-white px-3 py-1.5 text-sm font-medium text-purple-800 hover:bg-purple-50 ${FOCUS}`}>
      Open {task.link.label} <ChevronRight className="h-4 w-4" aria-hidden />
    </Link>
  );
}

function TaskRow({ task, period, tick, busy, onToggle, localMode, printing, dueNote }: {
  task: Task; period: TickPeriod; tick: Tick | undefined; busy: boolean; onToggle: (done: boolean) => void;
  localMode: boolean; printing: boolean; dueNote?: { text: string; hot: boolean } | null;
}) {
  const [open, setOpen] = useState(false);
  const id = `task-${period}-${task.key}`;
  const done = !!tick;
  const shown = open || printing;
  return (
    <li className={`rounded-lg border p-3 ${done ? 'border-green-200 bg-green-50/50' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-start gap-3">
        <input id={id} type="checkbox" checked={done} disabled={busy} onChange={e => onToggle(e.target.checked)}
          className={`mt-1 h-5 w-5 shrink-0 accent-purple-600 ${FOCUS}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <label htmlFor={id} className={`font-medium ${done ? 'text-gray-600 line-through' : 'text-gray-900'}`}>{task.title}</label>
            <span className="text-xs text-gray-600">about {task.minutes} min</span>
            <RoleBadge role={task.role} />
            {dueNote && <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${dueNote.hot ? 'bg-purple-100 text-purple-900' : 'bg-gray-100 text-gray-700'}`}>{dueNote.text}</span>}
          </div>
          <p className="text-sm text-gray-700">{task.why}</p>
          {tick && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-green-800">
              <Check className="h-3.5 w-3.5" aria-hidden />
              {tick.by ? `Done by ${tick.by}` : localMode ? 'Done on this device' : 'Done'}{tick.at ? `, ${londonTime(tick.at)}` : ''}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" aria-expanded={shown} aria-controls={`${id}-steps`} onClick={() => setOpen(o => !o)}
              className={`no-print inline-flex items-center gap-1 rounded text-sm font-medium text-gray-800 underline-offset-2 hover:underline ${FOCUS}`}>
              {shown ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
              {shown ? 'Hide steps' : 'Show steps'}
            </button>
            <OpenLink task={task} />
          </div>
          {shown && <div id={`${id}-steps`} className="mt-2"><Steps steps={task.steps} /></div>}
        </div>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------------------------

function ScheduleView({ printing }: { printing: boolean }) {
  void printing;
  return (
    <div className="space-y-8">
      <h2 className="text-xl font-bold text-gray-900">Schedule</h2>
      {ROUTINES.map(r => (
        <section key={r.id} aria-labelledby={`sched-${r.id}`} className="space-y-3">
          <div>
            <h3 id={`sched-${r.id}`} className="text-lg font-semibold text-gray-900">{r.title}</h3>
            <p className="text-sm text-gray-700">{r.summary} <span className="text-gray-600">({r.when}.)</span></p>
          </div>
          <ul className="space-y-3">
            {r.tasks.map(t => (
              <li key={t.key} className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h4 className="font-medium text-gray-900">{t.title}</h4>
                  <span className="text-xs text-gray-600">about {t.minutes} min</span>
                  <RoleBadge role={t.role} />
                  {r.id === 'weekly' && t.dueDay && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">Due {WEEKDAY_NAMES[t.dueDay - 1]}</span>}
                  {r.id === 'monthly' && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">First working day</span>}
                  {t.venues && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">{t.venues.map(v => (v === 'spitalfields' ? 'Spitalfields' : 'Covent Garden')).join(', ')} only</span>}
                </div>
                <p className="mb-2 text-sm text-gray-700">{t.why}</p>
                <Steps steps={t.steps} />
                <div className="mt-2"><OpenLink task={t} /></div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function guideText(g: Guide): string {
  return [g.title, g.summary, ...g.sections.flatMap(s => [s.heading, ...s.body])].join(' ').toLowerCase().replace(/\*\*/g, '');
}

function GuidesView({ filter, setFilter, printing }: { filter: string; setFilter: (v: string) => void; printing: boolean }) {
  const q = filter.trim().toLowerCase();
  const shown = GUIDES.filter(g => !q || guideText(g).includes(q));
  const [openSlugs, setOpenSlugs] = useState<string[]>([]);
  const toggle = (slug: string) => setOpenSlugs(o => (o.includes(slug) ? o.filter(s => s !== slug) : [...o, slug]));
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-gray-900">Guides</h2>
      <div className="no-print">
        <label htmlFor="guide-filter" className="mb-1 block text-sm font-medium text-gray-900">Search the guides</label>
        <input id="guide-filter" type="search" value={filter} onChange={e => setFilter(e.target.value)} placeholder="For example: packing slip, sticker, frame"
          className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm ${FOCUS}`} />
        <p className="mt-1 text-xs text-gray-600" role="status" aria-live="polite">{q ? `${shown.length} of ${GUIDES.length} guides match.` : `${GUIDES.length} guides.`}</p>
      </div>
      {shown.length === 0 && <p className="text-sm text-gray-700">No guide mentions that. Try a shorter word.</p>}
      {shown.map(g => {
        const open = printing || !!q || openSlugs.includes(g.slug);
        return (
          <section key={g.slug} id={g.slug} aria-labelledby={`guide-${g.slug}`} className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 id={`guide-${g.slug}`} className="text-lg font-semibold text-gray-900">
              <button type="button" aria-expanded={open} aria-controls={`guide-body-${g.slug}`} onClick={() => toggle(g.slug)}
                className={`flex w-full items-center gap-1 rounded text-left ${FOCUS}`}>
                {open ? <ChevronDown className="h-5 w-5 shrink-0" aria-hidden /> : <ChevronRight className="h-5 w-5 shrink-0" aria-hidden />}
                {g.title}
              </button>
            </h3>
            <p className="ml-6 text-sm text-gray-700">{g.summary}</p>
            {open && (
              <div id={`guide-body-${g.slug}`} className="ml-6 mt-3 space-y-5">
                {g.sections.map(s => (
                  <div key={s.heading}>
                    <h4 className="mb-1 font-semibold text-gray-900">{s.heading}</h4>
                    <div className="space-y-2 text-sm text-gray-800">
                      {s.body.map((p, i) => <p key={i}><Rich text={p} /></p>)}
                    </div>
                    {s.links && s.links.length > 0 && (
                      <p className="no-print mt-2 flex flex-wrap gap-2 text-sm">
                        {s.links.map(l => (
                          <Link key={l.href} href={l.href} className={`rounded-lg border border-purple-300 px-2.5 py-1 font-medium text-purple-800 hover:bg-purple-50 ${FOCUS}`}>Open {l.label}</Link>
                        ))}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function TroubleshootingView() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">Troubleshooting</h2>
      <p className="text-sm text-gray-700">
        If something here does not fix it, ask the owner. For anything a customer needs to be told, write from support@pawtraits.pics.
      </p>
      <ul className="space-y-3">
        {TROUBLESHOOTING.map((t: TroubleEntry) => (
          <li key={t.problem} className="rounded-lg border border-gray-200 bg-white p-3">
            <h3 className="font-semibold text-gray-900">If: {t.problem}</h3>
            <Steps steps={t.fix} />
            <p className="mt-2 text-sm text-gray-800"><span className="font-medium">Who to ask:</span> {t.who}</p>
            {t.link && <div className="mt-2"><Link href={t.link.href} className={`no-print inline-flex items-center gap-1 rounded-lg border border-purple-300 px-3 py-1.5 text-sm font-medium text-purple-800 hover:bg-purple-50 ${FOCUS}`}>Open {t.link.label}</Link></div>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function GlossaryView() {
  const sorted = [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term));
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">Glossary</h2>
      <dl className="grid gap-3 md:grid-cols-2">
        {sorted.map(g => (
          <div key={g.term} className="rounded-lg border border-gray-200 bg-white p-3">
            <dt className="font-semibold text-gray-900">{g.term}</dt>
            <dd className="text-sm text-gray-800">{g.meaning}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
