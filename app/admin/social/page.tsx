'use client';

/**
 * Admin → Social (spec docs/specs/social-loop.md). Paid customised portraits become before/after
 * items for the website feed and Instagram carousels. Here: channel switches (kill switch),
 * counts, every item with its photo-check result (hide, feature anyway, re-check), stall towns,
 * and posted carousels that need taking down after an opt-out.
 * Data: /api/admin/social* via AdminSupabaseService.
 */
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';
import { AdminSupabaseService } from '@/lib/admin-supabase';
import InstagramPreview from '@/components/admin/social/InstagramPreview';

type View = 'all' | 'featured' | 'rejected' | 'checking' | 'opted_out' | 'hidden';
interface Item {
  id: string; orderNumber: string | null; petName: string | null; place: string | null; locationSource: string;
  channel: 'online' | 'stall'; stallName: string | null; beforeThumb: string; afterThumb: string;
  checkStatus: 'pending' | 'approved' | 'rejected' | 'error'; checkReasons: string[]; optedOut: boolean; hidden: boolean;
  batchId: string | null; paidAt: string; source: 'purchase' | 'preview'; igExcluded: boolean;
}
interface Data {
  settings: { social_feed_enabled: boolean; social_instagram_enabled: boolean; social_photo_check_enabled: boolean; social_include_previews: boolean };
  heroItemId: string | null;
  counts: { total: number; featured: number; rejected: number; checking: number; optedOut: number; hidden: number };
  items: Item[];
  stalls: { id: string; name: string; town: string | null; country: string | null }[];
  removals: { id: string; ig_permalink: string | null; posted_at: string | null }[];
}

const REASON_LABELS: Record<string, string> = {
  person: 'Person in photo', child: 'Child', personal_details: 'Personal details visible', no_pet: 'No clear pet',
  failed_portrait: 'Portrait looks wrong', inappropriate: 'Inappropriate', unreadable: 'Check failed',
};
const SWITCHES: { key: keyof Data['settings']; label: string; help: string }[] = [
  { key: 'social_feed_enabled', label: 'Website feed', help: '"Recent custom creations around the world" on the home page' },
  { key: 'social_instagram_enabled', label: 'Instagram posting', help: 'Carousels of 5 before/afters, posted automatically (needs the Meta app connected)' },
  { key: 'social_photo_check_enabled', label: 'Automatic photo check', help: 'Leaves out photos with people, children, personal details or a broken portrait' },
  { key: 'social_include_previews', label: 'Include free previews', help: 'Feature customisations people made but haven’t bought yet, as well as purchases (website and Instagram)' },
];

function StatusBadge({ item }: { item: Item }) {
  if (item.optedOut) return <span className="rounded bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-800">Opted out</span>;
  if (item.hidden) return <span className="rounded bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-800">Hidden</span>;
  if (item.checkStatus === 'approved') return <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">Featured</span>;
  if (item.checkStatus === 'rejected') return <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">Left out</span>;
  return <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">{item.checkStatus === 'error' ? 'Check failed' : 'Checking'}</span>;
}

export default function AdminSocialPage() {
  const [view, setView] = useState<View>('all');
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [towns, setTowns] = useState<Record<string, string>>({});
  const [section, setSection] = useState<'pets' | 'instagram'>('pets');
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await new AdminSupabaseService().getSocial(view);
    if (r.ok) {
      setData(r.data); setError(null);
      // Keep any town being typed when the list reloads (switching tabs, other actions)
      setTowns(prev => Object.fromEntries((r.data.stalls as Data['stalls']).map(s => [s.id, prev[s.id] ?? s.town ?? ''])));
    } else setError(r.error);
  }, [view]);
  useEffect(() => { load(); }, [load]);

  async function toggle(key: keyof Data['settings'], value: boolean) {
    setBusy(key);
    const r = await new AdminSupabaseService().updateAppSetting(key, value);
    setBusy(null);
    if (!r.ok) { setError(r.error); return; }
    setData(d => (d ? { ...d, settings: { ...d.settings, [key]: value } } : d));
  }

  async function act(id: string, action: 'hide' | 'unhide' | 'approve' | 'recheck' | 'ig_include' | 'set_hero' | 'clear_hero') {
    setBusy(id);
    const r = await new AdminSupabaseService().updateSocialItem(id, action);
    setBusy(null);
    if (!r.ok) { setError(r.error); return; }
    load();
  }

  async function saveTown(id: string) {
    setBusy(id);
    const r = await new AdminSupabaseService().updateStallTown(id, towns[id] ?? '');
    setBusy(null);
    if (!r.ok) setError(r.error); else load();
  }

  async function importPreviews() {
    setBusy('import'); setNotice(null);
    const r = await new AdminSupabaseService().importSocialPreviews(30);
    setBusy(null);
    if (!r.ok) { setError(r.error); return; }
    setNotice(r.data.added ? `Added ${r.data.added} preview${r.data.added === 1 ? '' : 's'} from the last 30 days and checked them. Click again for more.` : 'No new previews from the last 30 days.');
    load();
  }

  async function retry() {
    setBusy('retry');
    const r = await new AdminSupabaseService().retrySocialChecks();
    setBusy(null);
    if (!r.ok) setError(r.error); else load();
  }

  if (!data && !error) return <div className="p-6 text-gray-600">Loading…</div>;

  const c = data?.counts;
  const tabs: [View, string, number | undefined][] = [
    ['all', 'All', c?.total], ['featured', 'Featured', c?.featured], ['rejected', 'Left out', c?.rejected],
    ['checking', 'Checking', c?.checking], ['opted_out', 'Opted out', c?.optedOut], ['hidden', 'Hidden', c?.hidden],
  ];

  return (
    <div className="max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Social</h1>
        <p className="mt-1 text-sm text-gray-600">
          Every paid customised Pawtrait (and, if switched on, every free preview) becomes a before/after for the website feed and Instagram,
          showing only the pet&rsquo;s first name and town. Customers can opt out from their order email.
        </p>
      </div>

      {error && <div role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      {data && data.removals.length > 0 && (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4">
          <p className="flex items-center gap-2 font-semibold text-red-800"><AlertTriangle className="h-5 w-5" aria-hidden="true" /> Take these Instagram posts down</p>
          <p className="mt-1 text-sm text-red-800">A customer in each has opted out (or you hid their pet). Delete or edit the post in the Instagram app.</p>
          <ul className="mt-2 space-y-1 text-sm">
            {data.removals.map(r => (
              <li key={r.id}>{r.ig_permalink ? <a href={r.ig_permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-red-900 underline">{r.ig_permalink} <ExternalLink className="h-3.5 w-3.5" /></a> : `Carousel ${r.id.slice(0, 8)}`}</li>
            ))}
          </ul>
        </div>
      )}

      {data && (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Channels">
          {SWITCHES.map(s => (
            <label key={s.key} className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-white p-4">
              <input type="checkbox" className="mt-1 h-5 w-5 accent-purple-700" checked={data.settings[s.key]} disabled={busy === s.key}
                onChange={e => toggle(s.key, e.target.checked)} />
              <span>
                <span className="block font-semibold text-gray-900">{s.label} <span className={`ml-1 text-xs font-semibold ${data.settings[s.key] ? 'text-green-700' : 'text-gray-500'}`}>{data.settings[s.key] ? 'On' : 'Off'}</span></span>
                <span className="block text-sm text-gray-600">{s.help}</span>
              </span>
            </label>
          ))}
        </section>
      )}

      {notice && <div role="status" className="rounded border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">{notice}</div>}

      {data?.settings.social_include_previews && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="flex-1 text-sm text-blue-900">Free previews made from now on are added automatically. Bring in recent ones to get started:</p>
          <button type="button" onClick={importPreviews} disabled={busy === 'import'}
            className="rounded-lg bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
            {busy === 'import' ? 'Importing and checking…' : 'Import previews from the last 30 days'}
          </button>
        </div>
      )}

      <div role="tablist" aria-label="Social sections" className="flex gap-1 border-b border-gray-200">
        {([['pets', 'Pets'], ['instagram', 'Instagram carousels']] as const).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={section === key} onClick={() => setSection(key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm ${section === key ? 'border-purple-600 font-semibold text-purple-800' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>{label}</button>
        ))}
      </div>

      {section === 'instagram' && <InstagramPreview onError={setError} />}

      {section === 'pets' && data && data.stalls.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="font-semibold text-gray-900">Stall towns</h2>
          <p className="text-sm text-gray-600">Shown for orders taken at each stall, e.g. &ldquo;Old Spitalfields Market, London&rdquo;.</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {data.stalls.map(s => (
              <div key={s.id} className="flex items-center gap-2">
                <label htmlFor={`town-${s.id}`} className="w-48 truncate text-sm font-medium text-gray-800">{s.name}</label>
                <input id={`town-${s.id}`} value={towns[s.id] ?? ''} placeholder="Town" maxLength={40}
                  onChange={e => setTowns(t => ({ ...t, [s.id]: e.target.value }))}
                  className="w-40 rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
                <button type="button" onClick={() => saveTown(s.id)} disabled={busy === s.id || (towns[s.id] ?? '') === (s.town ?? '')}
                  className="rounded-lg bg-purple-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40">Save</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {section === 'pets' && <section className="rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4">
          <div role="tablist" aria-label="Items" className="flex flex-wrap">
            {tabs.map(([key, label, n]) => (
              <button key={key} type="button" role="tab" aria-selected={view === key} onClick={() => setView(key)}
                className={`-mb-px border-b-2 px-3 py-3 text-sm ${view === key ? 'border-purple-600 font-semibold text-purple-800' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
                {label}{n !== undefined && <span className="ml-1 text-gray-500">{n}</span>}
              </button>
            ))}
          </div>
          {(c?.checking ?? 0) > 0 && (
            <button type="button" onClick={retry} disabled={busy === 'retry'} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${busy === 'retry' ? 'animate-spin' : ''}`} aria-hidden="true" /> Run waiting checks
            </button>
          )}
        </div>

        {data && data.items.length === 0 ? (
          <p className="p-6 text-sm text-gray-600">Nothing here yet. Paid customised Pawtraits appear here automatically.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {data?.items.map(i => (
              <li key={i.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
                <div className="flex shrink-0 gap-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={i.beforeThumb} alt="Customer photo" className="h-[100px] w-[80px] rounded-md bg-gray-100 object-cover" loading="lazy" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={i.afterThumb} alt="Portrait" className="h-[100px] w-[80px] rounded-md bg-gray-100 object-cover" loading="lazy" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900">{i.petName ?? <span className="text-gray-500">No usable pet name</span>} <StatusBadge item={i} />
                    {i.source === 'preview' && <span className="ml-1 rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">Preview</span>}
                    {i.igExcluded && <span className="ml-1 rounded bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">Not on Instagram</span>}
                    {data?.heroItemId === i.id && <span className="ml-1 rounded bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800">Home page hero</span>}</p>
                  <p className="text-sm text-gray-700">
                    {i.place ?? <span className="text-gray-500">No location</span>}
                    {i.channel === 'stall' && i.stallName ? ` · ${i.stallName}` : ''}
                    <span className="text-gray-500"> · {new Date(i.paidAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}{i.orderNumber ? ` · ${i.orderNumber}` : ''}</span>
                  </p>
                  {i.checkReasons.length > 0 && <p className="text-sm text-red-700">{i.checkReasons.map(r => REASON_LABELS[r] ?? r).join(' · ')}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {!i.optedOut && (data?.heroItemId === i.id ? (
                    <button type="button" onClick={() => act(i.id, 'clear_hero')} disabled={busy === i.id} className="rounded-lg border border-purple-300 px-3 py-1.5 text-sm font-semibold text-purple-800 disabled:opacity-50">Stop using as hero</button>
                  ) : (
                    <button type="button" onClick={() => act(i.id, 'set_hero')} disabled={busy === i.id} className="rounded-lg border border-purple-300 px-3 py-1.5 text-sm font-semibold text-purple-800 disabled:opacity-50" title="Show at the top of the home page (features it too)">Use as home hero</button>
                  ))}
                  {i.checkStatus === 'rejected' && !i.optedOut && (
                    <button type="button" onClick={() => act(i.id, 'approve')} disabled={busy === i.id} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold disabled:opacity-50">Feature anyway</button>
                  )}
                  {(i.checkStatus === 'error' || i.checkStatus === 'rejected') && !i.optedOut && (
                    <button type="button" onClick={() => act(i.id, 'recheck')} disabled={busy === i.id} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold disabled:opacity-50">Re-check</button>
                  )}
                  {i.igExcluded && !i.optedOut && (
                    <button type="button" onClick={() => act(i.id, 'ig_include')} disabled={busy === i.id} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold disabled:opacity-50">Allow on Instagram</button>
                  )}
                  {!i.optedOut && (
                    <button type="button" onClick={() => act(i.id, i.hidden ? 'unhide' : 'hide')} disabled={busy === i.id}
                      className={`rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50 ${i.hidden ? 'border border-gray-300' : 'bg-gray-900 text-white'}`}>
                      {i.hidden ? 'Show again' : 'Hide'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>}
    </div>
  );
}
