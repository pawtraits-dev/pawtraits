'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AdminSupabaseService } from '@/lib/admin-supabase';
import { SETTING_RATE_KEYS } from '@/lib/referrals/rates';

type Period = '30' | '90' | '365' | 'all';
type Sort = 'network' | 'direct' | 'descendants' | 'opens' | 'credit';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'all', label: 'All time' }, { key: '30', label: 'Last 30 days' }, { key: '90', label: 'Last 90 days' }, { key: '365', label: 'Last 12 months' },
];
const SORTS: { key: Sort; label: string }[] = [
  { key: 'network', label: 'Network value' }, { key: 'direct', label: 'Sales value with their code' }, { key: 'descendants', label: 'Descendant value' },
  { key: 'opens', label: 'Link opens' }, { key: 'credit', label: 'Credit earned' },
];

interface Row {
  id: string; profileId: string | null; name: string; email: string; code: string; linkOpens: number;
  direct: { orders: number; value: number; discount: number; buyers: number };
  referred: number;
  credit: { earned: number; orders: number; balance: number };
  descendants: { people: number; orders: number; value: number; depth: number };
  network: { orders: number; value: number };
  uncredited: number; lastUsed: string | null;
}
interface Summary { customersWithCode: number; codesUsed: number; linkOpens: number; referredOrders: number; referredValue: number; creditGiven: number; uncredited: number; deepestChain: number; unconfirmedReferrals?: number }
interface Data { rows: Row[]; total: number; summary: Summary; truncated: boolean; sourceTruncated: boolean }
interface TreeNode { name: string; email: string; code: string | null; direct: { orders: number; value: number }; children: TreeNode[] }
interface TreeData { root: TreeNode; truncated: boolean }

const int = (n: number) => n.toLocaleString('en-GB');
const money = (pence: number) => `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const th = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600';
const thNum = `${th} text-right`;
const td = 'px-3 py-2 text-sm text-gray-900';
const tdNum = `${td} text-right tabular-nums`;

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="pt-6">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-600">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">{value}</p>
    </CardContent></Card>
  );
}

function TreeLines({ node, level }: { node: TreeNode; level: number }) {
  return (
    <>
      <li style={{ paddingLeft: `${level * 1.25}rem` }} className="py-0.5 text-sm text-gray-900">
        <span className="font-medium">{node.name}</span>
        {node.code && <span className="ml-2 font-mono text-xs text-gray-600">{node.code}</span>}
        <span className="ml-2 text-gray-600">{node.code ? `${int(node.direct.orders)} ${node.direct.orders === 1 ? 'sale' : 'sales'} · ${money(node.direct.value)}` : 'No code'}</span>
      </li>
      {node.children.map((c, i) => <TreeLines key={`${c.email}-${i}`} node={c} level={level + 1} />)}
    </>
  );
}

/** The two referral percentages (settings), edited here: saved one at a time through the admin settings route */
function RatesCard() {
  const [service] = useState(() => new AdminSupabaseService());
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    const result = await service.getAppSettings();
    if (!result.ok) { setMsg({ type: 'err', text: result.error }); return; }
    setDraft(Object.fromEntries(SETTING_RATE_KEYS.map(k => [k, String(result.data[k]?.value ?? '')])));
  }, [service]);
  useEffect(() => { load(); }, [load]);

  async function save(key: string) {
    setSaving(key); setMsg(null);
    const raw = (draft[key] ?? '').trim();
    const result = await service.updateAppSetting(key, /^\d+$/.test(raw) ? Number(raw) : raw);
    setSaving(null);
    if (!result.ok) { setMsg({ type: 'err', text: result.error }); return; }
    setMsg({ type: 'ok', text: 'Saved.' });
    load();
  }

  const fields = [
    { key: 'referral_friend_discount_pct', label: "Friend's discount (%)", help: "Off a new customer's first order, when they have an account and use a friend's code." },
    { key: 'referral_referrer_credit_pct', label: "Referrer's bonus (%)", help: "Store credit for the customer whose code was used, worth this share of their friend's first order." },
  ];
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Referral rates</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {fields.map(f => (
          <div key={f.key} className="flex items-end gap-3">
            <div className="flex-1">
              <label htmlFor={f.key} className="block text-sm font-medium text-gray-700">{f.label}</label>
              <p id={`${f.key}-help`} className="text-xs text-gray-600">{f.help}</p>
              <Input id={f.key} type="number" min={0} max={50} step={1} aria-describedby={`${f.key}-help`} value={draft[f.key] ?? ''} onChange={e => setDraft({ ...draft, [f.key]: e.target.value })} />
            </div>
            <Button type="button" disabled={saving === f.key} onClick={() => save(f.key)}>{saving === f.key ? 'Saving…' : 'Save'}</Button>
          </div>
        ))}
        <p className="text-sm text-gray-600">Changes apply to orders from now on. Credit already earned keeps its old rate. It can take a minute to reach every page.</p>
        {msg && <p role={msg.type === 'err' ? 'alert' : 'status'} className={`text-sm ${msg.type === 'ok' ? 'text-green-800' : 'text-red-700'}`}>{msg.text}</p>}
      </CardContent>
    </Card>
  );
}

export default function CustomerReferralsPage() {
  const [period, setPeriod] = useState<Period>('all');
  const [sort, setSort] = useState<Sort>('network');
  const [showAll, setShowAll] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [trees, setTrees] = useState<Record<string, TreeData | 'loading' | 'error'>>({});

  const query = useCallback((extra: Record<string, string> = {}) => {
    const p = new URLSearchParams({ period, sort, ...extra });
    if (showAll) p.set('all', '1');
    return `/api/admin/customer-referrals?${p.toString()}`;
  }, [period, sort, showAll]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setOpen(new Set());
    setTrees({});
    fetch(query(), { cache: 'no-store' })
      .then(async res => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'Could not load customer referrals');
        return json as Data;
      })
      .then(json => { if (!cancelled) setData(json); })
      .catch(e => { if (!cancelled) setError(e.message || 'Could not load customer referrals'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query]);

  const toggle = (id: string) => {
    const opening = !open.has(id);
    setOpen(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    if (opening && !trees[id]) {
      setTrees(t => ({ ...t, [id]: 'loading' }));
      fetch(query({ tree: id }), { cache: 'no-store' })
        .then(async res => { if (!res.ok) throw new Error(); return res.json() as Promise<TreeData>; })
        .then(json => setTrees(t => ({ ...t, [id]: json })))
        .catch(() => setTrees(t => ({ ...t, [id]: 'error' })));
    }
  };

  const download = async () => {
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch(query({ format: 'csv' }), { cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not download the file');
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `pawtraits-customer-referrals-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) { setError(e.message || 'Could not download the file'); }
    finally { setDownloading(false); }
  };

  const s = data?.summary;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Customer Referrals</h1>
        <p className="text-sm text-gray-600">How often each customer&apos;s referral code is used, and the sales that came from it and from the people they referred.</p>
      </div>

      <RatesCard />

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div>
            <label htmlFor="cr-period" className="block text-sm font-medium text-gray-700">Period</label>
            <select id="cr-period" value={period} onChange={e => setPeriod(e.target.value as Period)} className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm">
              {PERIODS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="cr-sort" className="block text-sm font-medium text-gray-700">Sort by</label>
            <select id="cr-sort" value={sort} onChange={e => setSort(e.target.value as Sort)} className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm">
              {SORTS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 pb-2">
            <input id="cr-all" type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} className="h-4 w-4" />
            <label htmlFor="cr-all" className="text-sm text-gray-700">Show customers whose code has not been used</label>
          </div>
          <Button type="button" variant="outline" onClick={download} disabled={downloading || loading}>{downloading ? 'Preparing…' : 'Download CSV'}</Button>
        </CardContent>
      </Card>

      <div aria-busy={loading} className="space-y-3">
        {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        {data?.sourceTruncated && <p role="status" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">There is more data than can be read at once (20,000 rows in one table), so these figures are incomplete. Try a shorter period.</p>}
        {loading && <p role="status" className="text-sm text-gray-600">Loading…</p>}

        {data && s && !loading && (
          <>
            {s.uncredited > 0 && (
              <p role="status" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {int(s.uncredited)} referred {s.uncredited === 1 ? 'sale' : 'sales'} used a code but gave the referrer no credit.
              </p>
            )}
            {(s.unconfirmedReferrals ?? 0) > 0 && (
              <p role="status" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {int(s.unconfirmedReferrals ?? 0)} {s.unconfirmedReferrals === 1 ? 'order' : 'orders'} used a referral code that could not be checked; see the order for details.
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Tile label="Customers with a code" value={int(s.customersWithCode)} />
              <Tile label="Codes used at least once" value={int(s.codesUsed)} />
              <Tile label="Link opens" value={int(s.linkOpens)} />
              <Tile label="Referred sales" value={int(s.referredOrders)} />
              <Tile label="Referred sales value" value={money(s.referredValue)} />
              <Tile label="Credit given" value={money(s.creditGiven)} />
              <Tile label="Sales with a code but no credit" value={int(s.uncredited)} />
              <Tile label="Longest chain of referrals" value={int(s.deepestChain)} />
            </div>

            {data.rows.length === 0 ? (
              <p className="rounded-md border border-gray-200 bg-white p-6 text-sm text-gray-600">No referral codes have been used yet.</p>
            ) : (
              <>
                <p className="text-sm text-gray-600">Showing {int(data.rows.length)} of {int(data.total)} customers{data.truncated ? '. Download the CSV for the first 500 in full detail, or narrow the period.' : '.'}</p>
                <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
                  <table className="min-w-full divide-y divide-gray-200">
                    <caption className="sr-only">Customer referral codes, their use and the sales that came from them</caption>
                    <thead className="bg-gray-50"><tr>
                      <th scope="col" className={th}><span className="sr-only">Details</span></th>
                      <th scope="col" className={th}>Customer</th>
                      <th scope="col" className={th}>Code</th>
                      <th scope="col" className={thNum}>Link opens</th>
                      <th scope="col" className={thNum}>Sales with their code</th>
                      <th scope="col" className={thNum}>Sales value</th>
                      <th scope="col" className={thNum}>People referred</th>
                      <th scope="col" className={thNum}>Descendants (people)</th>
                      <th scope="col" className={thNum}>Descendant sales</th>
                      <th scope="col" className={thNum}>Descendant value</th>
                      <th scope="col" className={thNum}>Network value</th>
                      <th scope="col" className={thNum}>Credit earned</th>
                      <th scope="col" className={thNum}>Credit balance</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.rows.map(r => {
                        const isOpen = open.has(r.id);
                        const tree = trees[r.id];
                        return (
                          <Fragment key={r.id}>
                            <tr>
                              <td className={td}>
                                <button type="button" aria-expanded={isOpen} aria-controls={`cr-tree-${r.id}`} onClick={() => toggle(r.id)} className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50">
                                  {isOpen ? 'Hide' : 'Tree'}<span className="sr-only"> of people referred by {r.name}</span>
                                </button>
                              </td>
                              <td className={td}>
                                {r.profileId ? <Link href={`/admin/customers/${r.profileId}`} className="text-blue-700 hover:underline">{r.name}</Link> : r.name}
                                {r.name !== r.email && <span className="block text-xs text-gray-500">{r.email}</span>}
                              </td>
                              <td className={`${td} font-mono text-xs`}>{r.code}</td>
                              <td className={tdNum}>{int(r.linkOpens)}</td>
                              <td className={tdNum}>{int(r.direct.orders)}</td>
                              <td className={tdNum}>{money(r.direct.value)}</td>
                              <td className={tdNum}>{int(r.referred)}</td>
                              <td className={tdNum}>{int(r.descendants.people)}</td>
                              <td className={tdNum}>{int(r.descendants.orders)}</td>
                              <td className={tdNum}>{money(r.descendants.value)}</td>
                              <td className={tdNum}>{money(r.network.value)}</td>
                              <td className={tdNum}>{money(r.credit.earned)}</td>
                              <td className={tdNum}>{money(r.credit.balance)}</td>
                            </tr>
                            {isOpen && (
                              <tr id={`cr-tree-${r.id}`} className="bg-gray-50">
                                <td />
                                <td colSpan={12} className="px-3 py-2">
                                  {tree === 'loading' || !tree ? <p role="status" className="text-sm text-gray-600">Loading…</p>
                                    : tree === 'error' ? <p role="alert" className="text-sm text-red-800">Could not load this tree.</p>
                                    : tree.root.children.length === 0 ? <p className="text-sm text-gray-600">Nobody has been referred by this customer yet.</p>
                                    : (
                                      <>
                                        <ul aria-label={`People referred by ${r.name}`}>
                                          {tree.root.children.map((c, i) => <TreeLines key={`${c.email}-${i}`} node={c} level={0} />)}
                                        </ul>
                                        {tree.truncated && <p className="mt-1 text-xs text-gray-600">(more not shown)</p>}
                                      </>
                                    )}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <ul className="list-disc space-y-1 pl-5 text-sm text-gray-600">
              <li>Sales value is what the buyer paid, including delivery.</li>
              <li>Descendants are people referred by the people this customer referred, to any depth. A sale is counted once per customer above it.</li>
              <li>Link opens are counted for all time, whatever period is chosen.</li>
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
