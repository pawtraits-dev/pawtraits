'use client';

/**
 * Admin home: how Pawtraits is doing and what needs doing.
 * Today / 7 days / 30 days: revenue (online and stall), orders, free previews, preview → order
 * conversion, stall QR scans and AI spend against the period before; a "Needs attention" list;
 * the last 30 days; top designs; the latest orders and previews; stalls.
 * Data: /api/admin/dashboard via AdminSupabaseService (lib/admin/dashboard.ts).
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, ChevronRight, Coins, Image as ImageIcon,
  Layers, Loader2, MapPin, Printer, QrCode, RefreshCw, ShoppingBag, Sparkles, Wand2,
} from 'lucide-react';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AdminSupabaseService } from '@/lib/admin-supabase';

type Period = 'today' | '7d' | '30d';
const PERIODS: { key: Period; label: string; vs: string }[] = [
  { key: 'today', label: 'Today', vs: 'yesterday' },
  { key: '7d', label: '7 days', vs: 'the 7 days before' },
  { key: '30d', label: '30 days', vs: 'the 30 days before' },
];
const gbp = (pence: number, dp = 0) => `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
const usd = (v: number | null) => (v === null ? '–' : `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 60) return `${Math.max(1, m)} min ago`;
  if (m < 24 * 60) return `${Math.round(m / 60)} h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

function Change({ value, prev, invert = false, vs }: { value: number | null; prev: number | null; invert?: boolean; vs: string }) {
  if (value === null || prev === null) return null;
  if (prev === 0) return <span className="text-xs text-gray-500">{value === 0 ? `same as ${vs}` : `new vs ${vs}`}</span>;
  const pct = Math.round(((value - prev) / prev) * 100);
  if (pct === 0) return <span className="text-xs text-gray-500">same as {vs}</span>;
  const good = invert ? pct < 0 : pct > 0;
  const Icon = pct > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center text-xs font-medium ${good ? 'text-green-700' : 'text-red-700'}`} title={`vs ${vs}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />{Math.abs(pct)}% <span className="ml-1 font-normal text-gray-500">vs {vs}</span>
    </span>
  );
}

function Tile({ icon: Icon, label, value, sub, change, href }: { icon: any; label: string; value: string; sub?: string; change?: React.ReactNode; href: string }) {
  return (
    <Link href={href} className="group rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span className="flex items-center gap-1.5"><Icon className="h-4 w-4 text-purple-600" aria-hidden />{label}</span>
        <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-purple-500" aria-hidden />
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-600">{sub}</p>}
      <div className="mt-1">{change}</div>
    </Link>
  );
}

export default function AdminDashboard() {
  const [period, setPeriod] = useState<Period>('7d');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);

  const load = useCallback(async (p: Period) => {
    setLoading(true); setError(null);
    const r = await new AdminSupabaseService().getDashboard(p);
    if (r.ok) { setData(r.data); setLoadedAt(new Date()); } else setError(r.error);
    setLoading(false);
  }, []);
  useEffect(() => { load(period); }, [period, load]);

  const vs = PERIODS.find(p => p.key === period)!.vs;
  const k = data?.kpis;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-600">How Pawtraits is doing, and what needs doing.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5" role="tablist" aria-label="Period">
            {PERIODS.map(p => (
              <button key={p.key} role="tab" aria-selected={period === p.key} onClick={() => setPeriod(p.key)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${period === p.key ? 'bg-purple-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={() => load(period)} disabled={loading} aria-label="Refresh" title={loadedAt ? `Updated ${loadedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : 'Refresh'}
            className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {!data && loading && <p className="text-sm text-gray-500">Loading…</p>}

      {data && (
        <>
          {/* KPIs */}
          <div className={`grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6 ${loading ? 'opacity-60' : ''}`}>
            <Tile icon={Coins} label="Revenue" value={gbp(k.revenue.value)} sub={`Online ${gbp(k.revenue.online)} · Stalls ${gbp(k.revenue.stall)}`} change={<Change value={k.revenue.value} prev={k.revenue.prev} vs={vs} />} href="/admin/financial/revenue" />
            <Tile icon={ShoppingBag} label="Orders" value={String(k.orders.value)} sub={k.orders.value ? `Average ${gbp(k.orders.average, 2)}` : undefined} change={<Change value={k.orders.value} prev={k.orders.prev} vs={vs} />} href="/admin/orders" />
            <Tile icon={Wand2} label="Free previews" value={String(k.previews.value)} sub={k.previews.failed ? `${k.previews.failed} failed` : k.previews.value ? 'None failed' : undefined} change={<Change value={k.previews.value} prev={k.previews.prev} vs={vs} />} href="/admin/customisations" />
            <Tile icon={Sparkles} label="Preview → order" value={`${k.conversion.value}%`} sub={`${k.conversion.bought} bought`} change={<Change value={k.conversion.value} prev={k.conversion.prev} vs={vs} />} href="/admin/customisations" />
            <Tile icon={QrCode} label="Stall QR scans" value={String(k.scans.value)} change={<Change value={k.scans.value} prev={k.scans.prev} vs={vs} />} href="/admin/stock/qr-report" />
            <Tile icon={Coins} label="AI spend" value={usd(k.ai.value)} sub={k.ai.perOrder !== null ? `${usd(k.ai.perOrder)} per order` : undefined} change={<Change value={k.ai.value} prev={k.ai.prev} invert vs={vs} />} href="/admin/ai-costs" />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Needs attention */}
            <section className="rounded-xl border border-gray-200 bg-white p-4 lg:col-span-1">
              <h2 className="mb-3 font-semibold text-gray-900">Needs attention</h2>
              {data.attention.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-green-700"><CheckCircle2 className="h-5 w-5" /> All clear: nothing waiting on you.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {data.attention.map((a: any) => (
                    <li key={a.key}>
                      <Link href={a.href} className="flex items-center gap-3 py-2.5 text-sm hover:text-purple-700">
                        <span className={`flex h-7 min-w-[1.75rem] items-center justify-center rounded-full px-2 text-xs font-bold ${a.level === 'urgent' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900'}`}>{a.count}</span>
                        <span className="flex-1 text-gray-800">{a.label}</span>
                        {a.level === 'urgent' && <AlertTriangle className="h-4 w-4 text-red-600" aria-label="Urgent" />}
                        <ChevronRight className="h-4 w-4 text-gray-300" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Last 30 days */}
            <section className="rounded-xl border border-gray-200 bg-white p-4 lg:col-span-2">
              <h2 className="mb-1 font-semibold text-gray-900">Last 30 days</h2>
              <p className="mb-2 text-xs text-gray-500">Revenue by day (online and stalls) and free previews made.</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.trend.map((d: any) => ({ ...d, label: new Date(`${d.day}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), online: d.online / 100, stall: d.stall / 100 }))} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={4} />
                    <YAxis yAxisId="gbp" tick={{ fontSize: 11 }} tickFormatter={(v) => `£${v}`} width={48} />
                    <YAxis yAxisId="n" orientation="right" tick={{ fontSize: 11 }} allowDecimals={false} width={32} />
                    <Tooltip formatter={(v: any, name: any) => (name === 'Free previews' ? v : `£${Number(v).toFixed(2)}`)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar yAxisId="gbp" dataKey="online" name="Online" stackId="r" fill="#7c3aed" />
                    <Bar yAxisId="gbp" dataKey="stall" name="Stalls" stackId="r" fill="#c4b5fd" />
                    <Line yAxisId="n" type="monotone" dataKey="previews" name="Free previews" stroke="#d97706" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Top designs */}
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="mb-3 font-semibold text-gray-900">Top designs</h2>
              {data.top.length === 0 ? <p className="text-sm text-gray-500">No previews or orders in this period.</p> : (
                <ul className="space-y-2">
                  {data.top.map((d: any) => (
                    <li key={d.id} className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {d.thumb ? <img src={d.thumb} alt="" className="h-12 w-9 rounded object-cover" loading="lazy" /> : <span className="h-12 w-9 rounded bg-gray-100" />}
                      <span className="min-w-0 flex-1 truncate text-sm text-gray-800" title={d.title}>{d.title}</span>
                      <span className="text-right text-xs tabular-nums text-gray-600"><strong className="text-gray-900">{d.orders}</strong> sold<br />{d.previews} previews</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Latest orders */}
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Latest orders</h2>
                <Link href="/admin/orders" className="text-xs text-purple-700 hover:underline">All orders</Link>
              </div>
              {data.recentOrders.length === 0 ? <p className="text-sm text-gray-500">No paid orders in the last 30 days.</p> : (
                <ul className="divide-y divide-gray-100 text-sm">
                  {data.recentOrders.map((o: any) => (
                    <li key={o.id} className="flex items-center gap-2 py-2">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${o.channel === 'stall' ? 'bg-purple-100 text-purple-800' : 'bg-blue-50 text-blue-800'}`}>{o.channel}</span>
                      <span className="min-w-0 flex-1 truncate text-gray-800">{o.number}</span>
                      <span className={`text-xs ${o.state === 'error' ? 'font-semibold text-red-700' : 'text-gray-500'}`}>{o.state}</span>
                      <span className="w-16 text-right font-medium tabular-nums">{o.currency === 'GBP' ? gbp(o.amount, 2) : `${(o.amount / 100).toFixed(2)} ${o.currency}`}</span>
                      <span className="w-16 text-right text-xs text-gray-500">{ago(o.at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Latest previews */}
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Latest free previews</h2>
                <Link href="/admin/customisations" className="text-xs text-purple-700 hover:underline">All previews</Link>
              </div>
              {data.recentPreviews.length === 0 ? <p className="text-sm text-gray-500">No previews yet.</p> : (
                <ul className="grid grid-cols-5 gap-2">
                  {data.recentPreviews.map((p: any) => (
                    <li key={p.id} title={`${p.status}${p.source ? ` · from ${p.source}` : ''} · ${ago(p.at)}`}>
                      <div className={`relative aspect-[2/3] overflow-hidden rounded ${p.status === 'failed' ? 'bg-red-50' : 'bg-gray-100'}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {p.thumb ? <img src={p.thumb} alt="" className="h-full w-full object-cover" loading="lazy" /> : (
                          <span className={`flex h-full items-center justify-center text-[10px] ${p.status === 'failed' ? 'text-red-700' : 'text-gray-500'}`}>{p.status === 'failed' ? 'Failed' : 'Painting…'}</span>
                        )}
                        {p.bought && <span className="absolute left-0.5 top-0.5 rounded bg-green-600 px-1 text-[9px] font-bold text-white">SOLD</span>}
                      </div>
                      <p className="mt-0.5 truncate text-[10px] text-gray-500">{ago(p.at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Stalls */}
          {data.stalls.length > 0 && (
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 font-semibold text-gray-900"><MapPin className="h-4 w-4 text-purple-600" /> Stalls</h2>
                <Link href="/admin/stock/qr-report" className="text-xs text-purple-700 hover:underline">QR report</Link>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-gray-500"><th className="py-1 font-medium">Stall</th><th className="py-1 text-right font-medium">QR scans</th><th className="py-1 text-right font-medium">Sales</th><th className="py-1 text-right font-medium">Revenue</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {data.stalls.map((s: any) => (
                    <tr key={s.id}><td className="py-2 text-gray-800">{s.name}</td><td className="py-2 text-right tabular-nums">{s.scans}</td><td className="py-2 text-right tabular-nums">{s.orders}</td><td className="py-2 text-right font-medium tabular-nums">{gbp(s.revenue)}</td></tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* Shortcuts */}
          <section className="flex flex-wrap gap-2">
            {[
              { href: '/admin/catalog', label: 'Image catalog', icon: ImageIcon },
              { href: '/admin/variation-batches', label: 'Variation batches', icon: Layers },
              { href: '/admin/collections', label: 'Collections', icon: Layers },
              { href: '/admin/stock/trade-orders', label: 'Trade print orders', icon: Printer },
              { href: '/admin/social', label: 'Social', icon: Sparkles },
            ].map(s => (
              <Link key={s.href} href={s.href} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 hover:border-purple-300 hover:text-purple-700">
                <s.icon className="h-4 w-4 text-purple-600" aria-hidden />{s.label}
              </Link>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
