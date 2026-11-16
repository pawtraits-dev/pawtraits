'use client';

/**
 * Admin > Offers: new Pawtraits painted from a photo we already have (lib/offers/).
 * Pictures wait here for approval; "Approve and send" emails them (after the unsubscribe and "has bought" checks are made again).
 * Everything goes through /api/admin/offers/*. Nothing is generated or sent while "Offers" is switched off.
 */
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { AutomaticCard, AutomaticStats, OfferCard, OffersState } from '@/lib/offers/admin';

type Tab = 'ready' | 'queued' | 'sent' | 'problems' | 'campaigns';
type Pending = { title: string; body: string; label: string; run: () => Promise<void> } | null;

const dateFmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const AUDIENCE_WORDS: Record<string, string> = { previewers: 'Previewers', buyers: 'Buyers', both: 'Both' };
const SOURCE_WORDS: Record<string, string> = { preview_card: 'preview card', checkout: 'checkout', notice_email: 'notice email' };
const audienceName = (a: string) => (a === 'buyer' ? 'Buyer' : 'Previewer');
const shownWords = (o: OfferCard) => (o.shown ? `shown the photo wording ${dateFmt(o.shown.at)} (${SOURCE_WORDS[o.shown.source] ?? o.shown.source})` : '');

export default function OffersPage() {
  const { toast } = useToast();
  const [state, setState] = useState<OffersState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('ready');
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/offers', { credentials: 'include' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error || 'Could not load offers'); return; }
    setError(null); setState(d);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function call(url: string, body: unknown, key: string, done?: (d: any) => string | void) {
    setBusy(key);
    try {
      const r = await fetch(url, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) toast({ title: 'That did not work', description: d.error || 'Please try again', variant: 'destructive' });
      else { const msg = done?.(d); toast({ title: msg || 'Done' }); }
      await load();
      return r.ok;
    } finally { setBusy(null); }
  }
  const act = (id: string, action: string, extra: Record<string, unknown> = {}, done?: (d: any) => string | void) => call('/api/admin/offers', { action, id, ...extra }, `${action}:${id}:${extra.imageId ?? ''}`, done);
  const ask = (p: NonNullable<Pending>) => setPending(p);

  if (error) return <div className="p-6 text-red-700">{error}</div>;
  if (!state) return <div className="p-6">Loading…</div>;
  if (!state.migration) {
    return (
      <div className="p-6 max-w-2xl space-y-3">
        <h1 className="text-2xl font-bold">Offers</h1>
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Run the migration first</p>
          <p className="mt-1">Offers needs the tables in <code>{state.migrationFile}</code>. Run that file in the Supabase SQL editor, then reload this page. Until then Offers stays quietly off and nothing is generated or sent.</p>
        </div>
      </div>
    );
  }

  const s = state.settings;
  const by = (status: string[]) => state.offers.filter(o => status.includes(o.status));
  const lists: Record<Tab, OfferCard[]> = { ready: by(['ready']), queued: by(['queued', 'generating']), sent: by(['sent']), problems: by(['skipped', 'failed']), campaigns: [] };
  const TABS: { key: Tab; label: string; n: number }[] = [
    { key: 'ready', label: 'Waiting for approval', n: lists.ready.length }, { key: 'queued', label: 'Queued', n: lists.queued.length },
    { key: 'sent', label: 'Sent', n: lists.sent.length }, { key: 'problems', label: 'Skipped and failed', n: lists.problems.length },
    { key: 'campaigns', label: 'Campaigns', n: state.campaigns.length },
  ];
  const setting = (key: string, value: unknown) => call('/api/admin/offers/settings', { key, value }, `set:${key}`, () => 'Saved');

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Offers</h1>
        <p className="text-gray-600 mt-1">When someone asks for a preview by email, we keep their pet&apos;s photo and Pawcasso paints them into a few more designs. Pictures wait here until you approve them.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Settings</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-8">
            <label className="flex items-center gap-3">
              <Switch checked={s.enabled} disabled={busy === 'set:offers_enabled'} onCheckedChange={v => setting('offers_enabled', v)} aria-label="Offers on" />
              <span><span className="font-medium">Offers {s.enabled ? 'on' : 'off'}</span><br /><span className="text-xs text-gray-500">While off, nothing is queued, painted or sent.</span></span>
            </label>
            <label className="flex items-center gap-3">
              <Switch checked={s.autoSend} disabled={busy === 'set:offers_auto_send'} onCheckedChange={v => setting('offers_auto_send', v)} aria-label="Send automatically" />
              <span><span className="font-medium">Send automatically {s.autoSend ? 'on' : 'off'}</span><br /><span className="text-xs text-gray-500">Off: every offer waits for your approval.</span></span>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <NumberSetting label="Round 1: days after they open the preview email" value={s.round1Days} min={1} onSave={v => setting('offers_round1_days', v)} />
            <NumberSetting label="Round 2: days after round 1 is sent" value={s.round2Days} min={1} onSave={v => setting('offers_round2_days', v)} />
            <NumberSetting label="People painted per run" value={s.perRun} min={0} onSave={v => setting('offers_per_run', v)} />
            <NumberSetting label="People painted per day" value={s.perDay} min={0} onSave={v => setting('offers_per_day', v)} />
            <NumberSetting label="Zodiac: days before their sign starts" value={s.zodiacDaysBefore} min={5} onSave={v => setting('offers_zodiac_days_before', v)} />
            <NumberSetting label="Birthday: days before their birthday" value={s.birthdayDaysBefore} min={5} onSave={v => setting('offers_birthday_days_before', v)} />
            <NumberSetting label="Buyers: days after they are shown the photo wording" value={s.noticeGraceDays} min={0} onSave={v => setting('offers_notice_grace_days', v)} />
          </div>
          <div className="flex flex-wrap items-center gap-4 border-t pt-3">
            <p>Painted in the last 24 hours: <strong>{state.dayUsed}</strong> of {s.perDay}.</p>
            <p className="text-gray-600">{Object.entries(state.counts).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`).join(' · ') || 'No offers yet'}</p>
            <Button className="ml-auto" disabled={busy === 'run' || !s.enabled} onClick={() => call('/api/admin/offers/run', {}, 'run', d => d.reason === 'off' ? 'Offers are off' : `Queued ${d.queued}, painted ${d.generated}, sent ${d.sent}`)}>
              {busy === 'run' ? 'Running…' : 'Run now'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AutomaticCampaigns state={state} busy={busy} call={call} ask={ask} setting={setting} />
      <PastBuyers state={state} ask={ask} reload={load} />

      <div className="flex flex-wrap gap-2 border-b">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t.key ? 'border-purple-600 text-purple-800' : 'border-transparent text-gray-600'}`}>
            {t.label} ({t.n})
          </button>
        ))}
      </div>

      {tab === 'ready' && (lists.ready.length === 0 ? <p className="text-gray-600">Nothing is waiting for approval.</p> : lists.ready.map(o => (
        <Card key={o.id}>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {o.photoUrl && <img src={o.photoUrl} alt="Their photo" className="h-20 w-20 rounded object-cover" />}
              <div>
                <p className="font-semibold">{o.masked} · {o.petName || 'Unnamed pet'}{o.breed ? ` · ${o.breed}` : ''}</p>
                <p className="text-gray-600">{audienceName(o.audience)} · {o.label} · {o.audience === 'buyer' ? shownWords(o) : `first previewed: ${o.firstDesign || 'unknown'}`} · made {dateFmt(o.generatedAt)}{o.eventDate ? ` · for ${o.eventDate}` : ''}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {o.pictures.map(p => (
                <div key={p.id} className="rounded border p-2 text-sm">
                  {p.url && <img src={p.url} alt={p.title} className="w-full rounded" />}
                  <p className="mt-2 font-medium">{p.title}</p>
                  <p className="text-xs text-gray-500">{p.reason}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" disabled={!!busy || o.pictures.length <= 2} onClick={() => ask({ title: 'Drop this picture?', body: `${p.title} will be left out of the email.`, label: 'Drop it', run: async () => { await act(o.id, 'drop', { imageId: p.id }); } })}>Drop this picture</Button>
                    <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act(o.id, 'replace', { imageId: p.id }, () => 'Painted a different one')}>
                      {busy === `replace:${o.id}:${p.id}` ? 'Painting…' : 'Paint a different one'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={!!busy || o.pictures.length < 2} onClick={() => ask({ title: 'Approve and send?', body: `This emails ${o.masked} now with ${o.pictures.length} pictures.`, label: 'Approve and send', run: async () => { await act(o.id, 'approve', {}, d => d.message); } })}>Approve and send</Button>
              <Button variant="outline" disabled={!!busy} onClick={() => ask({ title: 'Skip this person?', body: 'Nothing is sent for this round.', label: 'Skip', run: async () => { await act(o.id, 'skip'); } })}>Skip this person</Button>
              <Button variant="outline" disabled={!!busy} onClick={() => ask({ title: 'Stop offers for this person?', body: 'They will get no more offers, and their photo is no longer used for them.', label: 'Stop offers', run: async () => { await act(o.id, 'stop'); } })}>Stop offers for this person</Button>
            </div>
          </CardContent>
        </Card>
      )))}

      {tab === 'queued' && <Table rows={lists.queued} cols={['Who', 'Offer', 'Status', 'Due']} cells={o => [`${o.masked} (${audienceName(o.audience)})`, o.label, o.status, dateFmt(o.dueAt)]} empty="Nothing is queued." />}
      {tab === 'sent' && <Table rows={lists.sent} cols={['Who', 'Offer', 'Sent', 'Clicked', 'Bought since']} cells={o => [`${o.masked} (${audienceName(o.audience)})`, o.label, dateFmt(o.sentAt), o.clickedAt ? dateFmt(o.clickedAt) : 'no', o.bought ? 'yes' : 'no']} empty="Nothing has been sent yet." />}
      {tab === 'problems' && <Table rows={lists.problems} cols={['Who', 'Offer', 'Status', 'Why', '']} cells={o => [`${o.masked} (${audienceName(o.audience)})`, o.label, o.status, o.error || '', o.status === 'failed' ? <Button key="t" size="sm" variant="outline" disabled={!!busy} onClick={() => act(o.id, 'retry')}>Try again</Button> : '']} empty="Nothing skipped or failed." />}
      {tab === 'campaigns' && <Campaigns state={state} busy={busy} call={call} />}

      <AlertDialog open={!!pending} onOpenChange={o => { if (!o) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending?.title}</AlertDialogTitle>
            <AlertDialogDescription>{pending?.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const p = pending; setPending(null); p?.run(); }}>{pending?.label}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NumberSetting({ label, value, min, onSave }: { label: string; value: number; min: number; onSave: (v: number) => void }) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  const n = parseInt(v, 10);
  return (
    <label className="block text-xs text-gray-600">
      {label}
      <div className="mt-1 flex gap-2">
        <Input type="number" min={min} value={v} onChange={e => setV(e.target.value)} />
        <Button size="sm" variant="outline" disabled={!Number.isInteger(n) || n < min || n === value} onClick={() => onSave(n)}>Save</Button>
      </div>
    </label>
  );
}

function Table({ rows, cols, cells, empty }: { rows: OfferCard[]; cols: string[]; cells: (o: OfferCard) => React.ReactNode[]; empty: string }) {
  if (!rows.length) return <p className="text-gray-600">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded border">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left"><tr>{cols.map((c, i) => <th key={i} className="px-3 py-2 font-medium">{c}</th>)}</tr></thead>
        <tbody>{rows.map(o => <tr key={o.id} className="border-t">{cells(o).map((c, i) => <td key={i} className="px-3 py-2">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function Campaigns({ state, busy, call }: { state: OffersState; busy: string | null; call: (url: string, body: unknown, key: string, done?: (d: any) => string | void) => Promise<boolean | undefined> }) {
  const { toast } = useToast();
  const [name, setName] = useState(''); const [subject, setSubject] = useState(''); const [intro, setIntro] = useState('');
  const [designs, setDesigns] = useState(''); const [collection, setCollection] = useState(''); const [who, setWho] = useState('both');
  const [audience, setAudience] = useState<Record<string, { eligible: number; previewers: number; buyers: number; designs: number }>>({});
  const [start, setStart] = useState<string | null>(null);

  async function check(id: string) {
    const r = await fetch('/api/admin/offers/campaigns', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'audience', id }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) toast({ title: 'Could not count', description: d.error, variant: 'destructive' });
    else setAudience(a => ({ ...a, [id]: d }));
  }
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-lg">New campaign</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-gray-600">Christmas, Valentine&apos;s, Mother&apos;s Day: 3 designs from the set you choose, for everyone who can be offered something right now.</p>
          <label className="block">Name<Input value={name} onChange={e => setName(e.target.value)} placeholder="Christmas 2026" /></label>
          <label className="block">Email subject (optional)<Input value={subject} onChange={e => setSubject(e.target.value)} /></label>
          <label className="block">One line of email copy (optional)<Input value={intro} onChange={e => setIntro(e.target.value)} /></label>
          <label className="block">Designs: paste design ids or customise links, one per line
            <textarea className="mt-1 w-full rounded border p-2" rows={4} value={designs} onChange={e => setDesigns(e.target.value)} />
          </label>
          <label className="block">and/or a collection
            <select className="mt-1 w-full rounded border p-2" value={collection} onChange={e => setCollection(e.target.value)}>
              <option value="">None</option>
              {state.collections.map(c => <option key={c.path} value={c.path}>{c.name} ({c.path})</option>)}
            </select>
          </label>
          <label className="block">Who gets it
            <select className="mt-1 w-full rounded border p-2" value={who} onChange={e => setWho(e.target.value)} disabled={!state.campaignsMigration}>
              <option value="previewers">Previewers (asked for a preview by email)</option>
              <option value="buyers">Buyers (have bought, and were shown the photo wording)</option>
              <option value="both">Both</option>
            </select>
            {!state.campaignsMigration && <span className="mt-1 block text-xs text-amber-800">Buyers need <code>{state.campaignsMigrationFile}</code> to be run first. Until then campaigns go to previewers only.</span>}
          </label>
          <Button disabled={busy === 'create' || !name.trim()} onClick={async () => { if (await call('/api/admin/offers/campaigns', { action: 'create', name, subject, intro, designs, collectionPath: collection, audience: state.campaignsMigration ? who : 'previewers' }, 'create', () => 'Campaign saved as a draft')) { setName(''); setSubject(''); setIntro(''); setDesigns(''); setCollection(''); } }}>Save campaign</Button>
        </CardContent>
      </Card>
      {state.campaigns.map(c => (
        <Card key={c.id}>
          <CardContent className="p-4 space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <p className="font-semibold">{c.name}</p><span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">{c.status}</span><span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-800">{AUDIENCE_WORDS[c.audience] ?? c.audience}</span>
              <p className="text-gray-600">{Object.entries(c.counts).map(([k, n]) => `${n} ${k}`).join(' · ')}</p>
            </div>
            <p className="text-gray-600">{c.designs.length ? `${c.designs.length} chosen: ${c.designs.map(d => d.title).join(', ')}` : ''}{c.collectionPath ? ` Collection: ${c.collectionPath}` : ''}</p>
            {c.status === 'draft' && (
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm" variant="outline" onClick={() => check(c.id)}>Count who is eligible</Button>
                {audience[c.id] && <span>{audience[c.id].eligible} eligible ({audience[c.id].previewers} previewers, {audience[c.id].buyers} buyers), drawing from {audience[c.id].designs} designs</span>}
                <Button size="sm" disabled={!state.settings.enabled || busy === `start:${c.id}`} onClick={() => setStart(c.id)}>Start</Button>
                {!state.settings.enabled && <span className="text-xs text-gray-500">Switch offers on to start</span>}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      <AlertDialog open={!!start} onOpenChange={o => { if (!o) setStart(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start this campaign?</AlertDialogTitle>
            <AlertDialogDescription>One offer is queued for everyone who is eligible now. Pictures are painted within the daily limit, then wait for your approval before anything is emailed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const id = start!; setStart(null); call('/api/admin/offers/campaigns', { action: 'start', id }, `start:${id}`, d => `Queued ${d.queued} offers`); }}>Start</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


type Call = (url: string, body: unknown, key: string, done?: (d: any) => string | void) => Promise<boolean | undefined>;
type Ask = (p: NonNullable<Pending>) => void;

/** Birthday and zodiac: built-in campaigns, each with its own switch (off until you turn it on) */
function AutomaticCampaigns({ state, busy, call, ask, setting }: { state: OffersState; busy: string | null; call: Call; ask: Ask; setting: (key: string, value: unknown) => Promise<boolean | undefined> }) {
  const [stats, setStats] = useState<{ birthday: AutomaticStats; zodiac: AutomaticStats } | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  useEffect(() => {
    if (!state.campaignsMigration) return;
    let live = true;
    fetch('/api/admin/offers/campaigns', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'auto_stats' }) })
      .then(async r => { const d = await r.json().catch(() => ({})); if (live) { if (r.ok) { setStats(d); setStatsError(null); } else setStatsError(d.error || 'Could not count'); } })
      .catch(() => { if (live) setStatsError('Could not count'); });
    return () => { live = false; };
  }, [state.campaignsMigration, state.settings.birthdayDaysBefore, state.settings.zodiacDaysBefore, state.settings.noticeGraceDays]);

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Automatic campaigns</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-gray-600">Pawcasso paints a pet into birthday designs ahead of their birthday, and a framed star-sign card ahead of their sign&apos;s season. Each one has its own switch and is off until you turn it on. Offers must be on too, and every offer still waits for your approval unless you send automatically.</p>
        {!state.campaignsMigration ? (
          <p className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-900">Run <code>{state.campaignsMigrationFile}</code> in the Supabase SQL editor, then reload this page. Until then these campaigns, offers to buyers and birthdays are quietly off.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {state.automatic.map(c => <AutoCard key={c.id} c={c} stats={stats ? stats[c.kind] : null} statsError={statsError} busy={busy} call={call} ask={ask} setting={setting} />)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AutoCard({ c, stats, statsError, busy, call, ask, setting }: { c: AutomaticCard; stats: AutomaticStats | null; statsError: string | null; busy: string | null; call: Call; ask: Ask; setting: (key: string, value: unknown) => Promise<boolean | undefined> }) {
  const [subject, setSubject] = useState(c.subject ?? ''); const [intro, setIntro] = useState(c.intro ?? '');
  useEffect(() => { setSubject(c.subject ?? ''); setIntro(c.intro ?? ''); }, [c.subject, c.intro]);
  const save = (patch: Record<string, unknown>, done = 'Saved') => call('/api/admin/offers/campaigns', { action: 'auto_save', kind: c.kind, ...patch }, `auto:${c.kind}`, () => done);
  const known = c.kind === 'birthday' ? 'Birthday' : 'Star sign';
  return (
    <div className="space-y-3 rounded border p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">{c.name}</p>
        <label className="flex items-center gap-2">
          <Switch checked={c.enabled} disabled={busy === `auto:${c.kind}`} aria-label={`${c.name} on`}
            onCheckedChange={v => (v ? ask({ title: `Switch ${c.name} on?`, body: 'People who are due are queued and painted within the daily limits, then wait for your approval before anything is emailed.', label: 'Switch on', run: async () => { await save({ enabled: true }, `${c.name} is on`); } }) : save({ enabled: false }, `${c.name} is off`))} />
          <span>{c.enabled ? 'On' : 'Off'}</span>
        </label>
      </div>
      <label className="block text-xs text-gray-600">Who gets it
        <select className="mt-1 w-full rounded border p-2 text-sm text-gray-900" value={c.audience} disabled={busy === `auto:${c.kind}`} onChange={e => save({ audience: e.target.value })}>
          <option value="previewers">Previewers</option><option value="buyers">Buyers</option><option value="both">Both</option>
        </select>
      </label>
      <NumberSetting label={c.kind === 'birthday' ? 'Days before their birthday' : 'Days before their sign starts'} value={c.daysBefore} min={5} onSave={v => setting(c.kind === 'birthday' ? 'offers_birthday_days_before' : 'offers_zodiac_days_before', v)} />
      <label className="block text-xs text-gray-600">Email subject (optional)<Input value={subject} onChange={e => setSubject(e.target.value)} placeholder={c.kind === 'birthday' ? "Biscuit's birthday is coming: Pawcasso got in early" : 'Leo season is coming, and Biscuit is ready'} /></label>
      <label className="block text-xs text-gray-600">One line of email copy (optional)<Input value={intro} onChange={e => setIntro(e.target.value)} /></label>
      <Button size="sm" variant="outline" disabled={busy === `auto:${c.kind}` || (subject === (c.subject ?? '') && intro === (c.intro ?? ''))} onClick={() => save({ subject, intro })}>Save wording</Button>
      <div className="border-t pt-2 text-xs text-gray-700">
        {stats ? (
          <>
            <p>{known} known for <strong>{stats.known}</strong> of {stats.total} people.{stats.known < stats.total ? ' Thin data means fewer offers.' : ''}</p>
            <p>Due in the next 30 days: <strong>{stats.due30}</strong></p>
            {stats.problem && <p className="mt-1 font-medium text-red-700">{stats.problem}</p>}
          </>
        ) : <p>{statsError ?? 'Counting…'}</p>}
        <p className="mt-1 text-gray-500">{Object.entries(c.counts).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`).join(' · ') || 'No offers yet'}</p>
      </div>
    </div>
  );
}

/** "Tell past buyers": the one-off notice that we have kept their pet's photo. Only ever sent from here, on a button press. */
function PastBuyers({ state, ask, reload }: { state: OffersState; ask: Ask; reload: () => Promise<void> }) {
  const { toast } = useToast();
  const [info, setInfo] = useState<{ migration: boolean; eligible: number; batch: number } | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const post = (action: string) => fetch('/api/admin/offers/notice', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
  const count = useCallback(async () => {
    const r = await fetch('/api/admin/offers/notice', { credentials: 'include', cache: 'no-store' }).catch(() => null);
    setInfo(r && r.ok ? await r.json() : null);
  }, []);
  useEffect(() => { count(); }, [count, state.campaignsMigration]);

  async function test() {
    setWorking('test');
    try {
      const r = await post('test'); const d = await r.json().catch(() => ({}));
      toast(r.ok ? { title: `Test sent to ${d.to}` } : { title: 'That did not work', description: d.error || 'Please try again', variant: 'destructive' });
    } finally { setWorking(null); }
  }
  async function sendAll() {
    setWorking('send');
    let total = 0;
    try {
      // 50 people per request, at most 10 requests (500 people) per press
      for (let i = 0; i < 10; i++) {
        const r = await post('send'); const d = await r.json().catch(() => ({}));
        if (!r.ok) { toast({ title: 'That did not work', description: d.error || 'Please try again', variant: 'destructive' }); break; }
        total += d.sent;
        if (!d.sent || !d.remaining) break;
      }
      toast({ title: `Sent to ${total} ${total === 1 ? 'buyer' : 'buyers'}` });
    } finally { setWorking(null); await count(); await reload(); }
  }
  const n = info?.eligible ?? 0;
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Tell past buyers</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-gray-600">A one-off email to people who have bought: we have kept the photo they sent, and from time to time Pawcasso may paint their pet into something new. They can say no with one click. Nobody gets an offer until this has gone to them and {state.settings.noticeGraceDays} {state.settings.noticeGraceDays === 1 ? 'day' : 'days'} have passed. Sent only when you press the button below, never automatically.</p>
        {!state.campaignsMigration || info?.migration === false ? (
          <p className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-900">Run <code>{state.campaignsMigrationFile}</code> first.</p>
        ) : (
          <>
            <p><strong>{info ? n : '…'}</strong> {n === 1 ? 'buyer' : 'buyers'} would get it (subscribed, with a photo we can use, not yet told).</p>
            {!state.settings.enabled && <p className="text-xs text-gray-500">Switch offers on to send.</p>}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={!state.settings.enabled || !!working} onClick={test}>{working === 'test' ? 'Sending…' : 'Send me a test'}</Button>
              <Button disabled={!state.settings.enabled || !!working || n === 0} onClick={() => ask({ title: `Send to ${n} ${n === 1 ? 'buyer' : 'buyers'}?`, body: `This emails the notice now, up to ${(info?.batch ?? 50) * 10} people in one go. It cannot be undone, and nobody is emailed twice.`, label: `Send to ${n}`, run: sendAll })}>
                {working === 'send' ? 'Sending…' : `Send to ${n} ${n === 1 ? 'buyer' : 'buyers'}`}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
