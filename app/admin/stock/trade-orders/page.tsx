'use client';

/**
 * Admin → Stock & Stalls → Trade print orders: foamex stock for the stalls, ordered by hand from
 * the UK trade printer (Gelato prints everything sold online).
 *
 * Build an order from (1) the stall sales of a period, to replace what sold, and/or (2) designs
 * picked from the catalogue, in S / M / L / XL. Then save the print-ready files into a folder
 * (or a ZIP): one PDF per line at the exact finished size, 300 dpi, no bleed or crop marks (the
 * printer's spec), named with the size and quantity, plus an order sheet (CSV). Upload them to
 * the printer and mark the order as placed.
 */
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Download, FolderDown, Loader2, Plus, Printer, RefreshCw, Search, Tag, Trash2 } from 'lucide-react';

type Size = 'S' | 'M' | 'L' | 'XL';
const SIZES: Size[] = ['S', 'M', 'L', 'XL'];
const SIZE_CM: Record<Size, string> = { S: '15×20', M: '20×30', L: '30×40', XL: '40×60' };
const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-gray-100 text-gray-700' },
  downloaded: { label: 'Files downloaded', cls: 'bg-blue-50 text-blue-800' },
  ordered: { label: 'Ordered', cls: 'bg-amber-50 text-amber-800' },
  received: { label: 'Received', cls: 'bg-green-50 text-green-800' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-50 text-red-700' },
};

interface Order { id: string; ref: string; printer: string; status: string; notes: string | null; printer_order_ref: string | null; sales_from: string | null; sales_to: string | null; created_at: string; downloaded_at: string | null; ordered_at: string | null; lines?: number; prints?: number }
interface Line { image_id: string; size: Size; quantity: number; source: 'manual' | 'sales'; sold: number | null; title: string; thumb: string | null; print?: { widthMm: number; heightMm: number; finalDpi: number; effectiveDpi: number; quality: 'good' | 'ok' | 'low'; cropNote: string | null; upscaled: boolean } | null; source_px?: number[] | null }

async function api<T = any>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { credentials: 'include', ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j;
}

export default function TradeOrdersPage() {
  return <Suspense><Inner /></Suspense>;
}

function Inner() {
  const sp = useSearchParams();
  const id = sp.get('id');
  return (
    <div className="mx-auto max-w-6xl p-6">
      {id ? <Editor id={id} /> : <List />}
    </div>
  );
}

// ---------------------------------------------------------------------------- list

function List() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  useEffect(() => { api<{ orders: Order[] }>('/api/admin/stock/trade-orders').then(d => setOrders(d.orders)).catch(e => setError(e.message)); }, []);
  const create = async () => {
    setCreating(true);
    try { const d = await api<{ order: Order }>('/api/admin/stock/trade-orders', { method: 'POST', body: JSON.stringify({}) }); router.push(`/admin/stock/trade-orders?id=${d.order.id}`); }
    catch (e: any) { setError(e.message); setCreating(false); }
  };
  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><Printer className="h-6 w-6 text-purple-600" /> Trade print orders</h1>
          <p className="text-sm text-gray-600">Foamex stock for the stalls from the trade printer. Online orders go to Gelato as usual.</p>
        </div>
        <button onClick={create} disabled={creating} className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60">
          <Plus className="h-4 w-4" /> New order
        </button>
      </div>
      {error && <p className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!orders && !error && <p className="text-sm text-gray-600">Loading…</p>}
      {orders && !orders.length && <p className="rounded-lg border bg-white p-6 text-center text-sm text-gray-600">No orders yet. Start one with New order.</p>}
      {orders && orders.length > 0 && (
        <table className="w-full overflow-hidden rounded-lg border bg-white text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr><th className="px-3 py-2">Order</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Prints</th><th className="px-3 py-2">Stall sales replaced</th><th className="px-3 py-2">Created</th></tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id} className="cursor-pointer border-t hover:bg-gray-50" onClick={() => router.push(`/admin/stock/trade-orders?id=${o.id}`)}>
                <td className="px-3 py-2 font-medium text-purple-700">{o.ref}{o.printer_order_ref ? <span className="text-gray-500"> · {o.printer_order_ref}</span> : null}</td>
                <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[o.status]?.cls}`}>{STATUS[o.status]?.label ?? o.status}</span></td>
                <td className="px-3 py-2 text-right tabular-nums">{o.prints ?? 0} <span className="text-gray-500">({o.lines ?? 0} lines)</span></td>
                <td className="px-3 py-2 text-gray-600">{o.sales_from && o.sales_to ? `${fmtDate(o.sales_from)} – ${fmtDate(o.sales_to)}` : '–'}</td>
                <td className="px-3 py-2 text-gray-600">{fmtDate(o.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// ---------------------------------------------------------------------------- editor

function Editor({ id }: { id: string }) {
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [salesWindow, setSalesWindow] = useState<{ from: string; to: string; location_ids: string[] } | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api<{ order: Order; lines: Line[] }>(`/api/admin/stock/trade-orders/${id}`);
      setOrder(d.order); setLines(d.lines); setDirty(false);
    } catch (e: any) { setError(e.message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const editable = order && ['draft', 'downloaded'].includes(order.status);

  const addLines = (add: Omit<Line, 'title' | 'thumb'>[] & any[], meta?: Record<string, { title: string; thumb: string | null }>) => {
    setLines(prev => {
      const next = [...prev];
      for (const a of add) {
        const i = next.findIndex(l => l.image_id === a.image_id && l.size === a.size);
        if (i >= 0) next[i] = { ...next[i], quantity: Math.min(999, next[i].quantity + a.quantity), sold: a.sold ?? next[i].sold, source: a.source === 'sales' ? 'sales' : next[i].source };
        else next.push({ ...a, title: meta?.[a.image_id]?.title ?? a.title ?? 'Design', thumb: meta?.[a.image_id]?.thumb ?? a.thumb ?? null, print: null });
      }
      return next;
    });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true); setError(null);
    try {
      await api(`/api/admin/stock/trade-orders/${id}/lines`, { method: 'PUT', body: JSON.stringify({ lines: lines.map(l => ({ image_id: l.image_id, size: l.size, quantity: l.quantity, source: l.source, sold: l.sold, source_px: l.source_px })), sales: salesWindow }) });
      await load();
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  };

  const patch = async (fields: Record<string, unknown>) => {
    setError(null);
    try { const d = await api<{ order: Order }>(`/api/admin/stock/trade-orders/${id}`, { method: 'PATCH', body: JSON.stringify(fields) }); setOrder(d.order); }
    catch (e: any) { setError(e.message); }
  };

  const remove = async () => {
    if (!confirm('Delete this draft order?')) return;
    try { await api(`/api/admin/stock/trade-orders/${id}`, { method: 'DELETE' }); router.push('/admin/stock/trade-orders'); }
    catch (e: any) { setError(e.message); }
  };

  const totals = useMemo(() => {
    const t: Record<Size, number> = { S: 0, M: 0, L: 0, XL: 0 };
    for (const l of lines) t[l.size] += l.quantity;
    return t;
  }, [lines]);

  if (!order) return <p className="text-sm text-gray-600">{error ?? 'Loading…'}</p>;

  return (
    <>
      <button onClick={() => router.push('/admin/stock/trade-orders')} className="mb-3 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-purple-700"><ArrowLeft className="h-4 w-4" /> All trade orders</button>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">{order.ref}</h1>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[order.status]?.cls}`}>{STATUS[order.status]?.label}</span>
        <input defaultValue={order.printer} onBlur={e => e.target.value !== order.printer && patch({ printer: e.target.value })} aria-label="Printer"
          className="rounded border border-gray-200 px-2 py-1 text-sm" />
        <div className="ml-auto flex flex-wrap gap-2 text-sm">
          {order.status === 'downloaded' && (
            <button onClick={() => { const ref = prompt('The printer’s order number (optional)') ?? ''; patch({ status: 'ordered', printer_order_ref: ref }); }}
              className="rounded-lg bg-amber-500 px-3 py-1.5 font-semibold text-white hover:bg-amber-600">Mark as ordered</button>
          )}
          {order.status === 'ordered' && <button onClick={() => patch({ status: 'received' })} className="rounded-lg bg-green-600 px-3 py-1.5 font-semibold text-white hover:bg-green-700">Mark as received</button>}
          {order.status === 'draft' && <button onClick={remove} className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-gray-700 hover:bg-gray-50"><Trash2 className="h-4 w-4" /> Delete</button>}
          {['downloaded', 'ordered'].includes(order.status) && <button onClick={() => patch({ status: 'cancelled' })} className="rounded-lg border px-3 py-1.5 text-gray-700 hover:bg-gray-50">Cancel order</button>}
        </div>
      </div>
      {order.printer_order_ref && <p className="-mt-3 mb-4 text-sm text-gray-600">Printer’s order number: <strong>{order.printer_order_ref}</strong>{order.ordered_at ? ` · ordered ${fmtDate(order.ordered_at)}` : ''}</p>}
      {error && <p className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {editable && (
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <SalesPicker onAdd={(rows, window) => { addLines(rows.map(r => ({ image_id: r.image_id, size: r.size, quantity: r.quantity, source: 'sales', sold: r.sold, title: r.title, thumb: r.thumb })) as any); setSalesWindow(window); }} />
          <CataloguePicker onAdd={(rows) => addLines(rows.map(r => ({ ...r, source: 'manual', sold: null })) as any)} />
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Prints in this order</h2>
          <span className="text-sm text-gray-600">{SIZES.filter(s => totals[s]).map(s => `${totals[s]} × ${s}`).join(' · ') || 'None yet'}</span>
          {editable && (
            <button onClick={save} disabled={!dirty || saving} className="ml-auto inline-flex items-center gap-1 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-40">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {dirty ? 'Save and check print quality' : 'Saved'}
            </button>
          )}
        </div>
        {!lines.length && <p className="p-6 text-center text-sm text-gray-500">Add stall sales to replace or designs from the catalogue above.</p>}
        {lines.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500">
              <tr><th className="px-4 py-2">Design</th><th className="px-2 py-2">Size</th><th className="px-2 py-2">Qty</th><th className="px-2 py-2">Why</th><th className="px-2 py-2">Print file</th><th /></tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={`${l.image_id}-${l.size}`} className="border-t">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {l.thumb ? <img src={l.thumb} alt="" className="h-14 w-11 rounded object-cover" /> : <span className="h-14 w-11 rounded bg-gray-100" />}
                      <span className="font-medium text-gray-900">{l.title}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <select value={l.size} disabled={!editable} onChange={e => { const size = e.target.value as Size; setLines(ls => ls.map((x, j) => (j === i ? { ...x, size, print: null } : x))); setDirty(true); }}
                      className="rounded border border-gray-200 px-1.5 py-1">
                      {SIZES.map(s => <option key={s} value={s}>{s} · {SIZE_CM[s]}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" min={1} max={999} value={l.quantity} disabled={!editable}
                      onChange={e => { const q = Math.max(1, Math.min(999, Number(e.target.value) || 1)); setLines(ls => ls.map((x, j) => (j === i ? { ...x, quantity: q } : x))); setDirty(true); }}
                      className="w-16 rounded border border-gray-200 px-2 py-1 tabular-nums" />
                  </td>
                  <td className="px-2 py-2 text-xs text-gray-600">{l.source === 'sales' ? `${l.sold ?? '?'} sold` : 'Added'}</td>
                  <td className="px-2 py-2 text-xs">
                    {l.print ? (
                      <span className={l.print.quality === 'good' ? 'text-green-700' : l.print.quality === 'ok' ? 'text-amber-700' : 'text-red-700'}>
                        {l.print.widthMm / 10}×{l.print.heightMm / 10} cm · {l.print.finalDpi} dpi{l.print.upscaled ? ' (AI upscaled)' : ''}{l.print.quality === 'low' ? ' · too small for this size' : ''}
                        {l.print.cropNote && <span className="block text-gray-500">{l.print.cropNote}</span>}
                      </span>
                    ) : <span className="text-gray-400">{dirty ? 'Save to check' : '–'}</span>}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {editable && <button onClick={() => { setLines(ls => ls.filter((_, j) => j !== i)); setDirty(true); }} aria-label={`Remove ${l.title} ${l.size}`} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {lines.length > 0 && <Downloader id={id} disabled={dirty} onDone={load} />}
      {lines.length > 0 && <Labels id={id} disabled={dirty} count={lines.reduce((n, l) => n + l.quantity, 0)} />}

      <label className="mt-6 block text-sm font-medium text-gray-800">Notes
        <textarea defaultValue={order.notes ?? ''} onBlur={e => e.target.value !== (order.notes ?? '') && patch({ notes: e.target.value })} rows={2}
          className="mt-1 w-full rounded border border-gray-200 p-2 text-sm" placeholder="Anything to remember about this order" />
      </label>
    </>
  );
}

// ---------------------------------------------------------------------------- sources

function SalesPicker({ onAdd }: { onAdd: (rows: { image_id: string; size: Size; quantity: number; sold: number; title: string; thumb: string | null }[], window: { from: string; to: string; location_ids: string[] }) => void }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [locs, setLocs] = useState<{ id: string; name: string }[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [rows, setRows] = useState<{ image_id: string; size: Size; sold: number; title: string; thumb: string | null; qty: number; on: boolean }[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const find = useCallback(async (f = from, t = to) => {
    setLoading(true); setError(null);
    try {
      const qs = new URLSearchParams({ ...(f ? { from: f } : {}), ...(t ? { to: t } : {}), ...(chosen.length ? { locations: chosen.join(',') } : {}) });
      const d = await api<any>(`/api/admin/stock/trade-orders/sales?${qs}`);
      setFrom(d.from); setTo(d.to); setLocs(d.locations);
      setRows(d.suggestions.map((s: any) => ({ ...s, qty: s.sold, on: true })));
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, [from, to, chosen]);
  useEffect(() => { find('', ''); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const picked = (rows ?? []).filter(r => r.on);
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-gray-900">Replace stall sales</h2>
      <p className="text-xs text-gray-600">Everything sold at the stalls in the period, by design and size. Starts the day after the last order’s period.</p>
      <div className="mt-3 flex flex-wrap items-end gap-2 text-sm">
        <label>From<input type="date" value={from} onChange={e => setFrom(e.target.value)} className="mt-0.5 block rounded border border-gray-200 px-2 py-1" /></label>
        <label>To<input type="date" value={to} onChange={e => setTo(e.target.value)} className="mt-0.5 block rounded border border-gray-200 px-2 py-1" /></label>
        <button onClick={() => find()} className="inline-flex items-center gap-1 rounded border px-3 py-1.5 hover:bg-gray-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Find sales</button>
      </div>
      {locs.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-700">
          {locs.map(l => (
            <label key={l.id} className="flex items-center gap-1">
              <input type="checkbox" checked={chosen.includes(l.id)} onChange={e => setChosen(c => (e.target.checked ? [...c, l.id] : c.filter(x => x !== l.id)))} /> {l.name}
            </label>
          ))}
          <span className="text-gray-500">{chosen.length ? '' : '(all stalls)'}</span>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      {rows && !rows.length && <p className="mt-3 text-sm text-gray-500">No stall sales in this period.</p>}
      {rows && rows.length > 0 && (
        <>
          <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto">
            {rows.map((r, i) => (
              <li key={`${r.image_id}-${r.size}`} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={r.on} onChange={e => setRows(rs => rs!.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))} aria-label={`Include ${r.title} ${r.size}`} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {r.thumb ? <img src={r.thumb} alt="" className="h-9 w-7 rounded object-cover" /> : <span className="h-9 w-7 rounded bg-gray-100" />}
                <span className="min-w-0 flex-1 truncate">{r.title}</span>
                <span className="w-8 text-gray-600">{r.size}</span>
                <span className="w-14 text-xs text-gray-500">{r.sold} sold</span>
                <input type="number" min={1} max={999} value={r.qty} onChange={e => setRows(rs => rs!.map((x, j) => (j === i ? { ...x, qty: Math.max(1, Number(e.target.value) || 1) } : x)))}
                  className="w-14 rounded border border-gray-200 px-1.5 py-0.5 tabular-nums" aria-label="Quantity to order" />
              </li>
            ))}
          </ul>
          <button disabled={!picked.length} onClick={() => onAdd(picked.map(r => ({ image_id: r.image_id, size: r.size, quantity: r.qty, sold: r.sold, title: r.title, thumb: r.thumb })), { from, to, location_ids: chosen })}
            className="mt-3 inline-flex items-center gap-1 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-40">
            <Plus className="h-4 w-4" /> Add {picked.reduce((n, r) => n + r.qty, 0)} prints to the order
          </button>
        </>
      )}
    </div>
  );
}

function CataloguePicker({ onAdd }: { onAdd: (rows: { image_id: string; size: Size; quantity: number; title: string; thumb: string | null }[]) => void }) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<{ total: number; pageSize: number; designs: { id: string; title: string; breed: string | null; thumb: string | null }[] } | null>(null);
  const [picked, setPicked] = useState<{ id: string; title: string; thumb: string | null } | null>(null);
  const [qty, setQty] = useState<Record<Size, number>>({ S: 0, M: 0, L: 0, XL: 0 });

  useEffect(() => {
    const t = setTimeout(() => {
      api<any>(`/api/admin/stock/trade-orders/designs?q=${encodeURIComponent(q)}&page=${page}`).then(setData).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [q, page]);

  const add = () => {
    if (!picked) return;
    const rows = SIZES.filter(s => qty[s] > 0).map(s => ({ image_id: picked.id, size: s, quantity: qty[s], title: picked.title, thumb: picked.thumb }));
    if (rows.length) onAdd(rows);
    setPicked(null); setQty({ S: 0, M: 0, L: 0, XL: 0 });
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-gray-900">Add from the catalogue</h2>
      <p className="text-xs text-gray-600">Pick a design, then how many of each size.</p>
      <input value={q} onChange={e => { setQ(e.target.value); setPage(0); }} placeholder="Search designs" className="mt-3 w-full rounded border border-gray-200 px-3 py-1.5 text-sm" />
      {picked ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-purple-50 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {picked.thumb && <img src={picked.thumb} alt="" className="h-16 w-12 rounded object-cover" />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900">{picked.title}</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {SIZES.map(s => (
                <label key={s} className="text-xs text-gray-700">{s} <span className="text-gray-500">{SIZE_CM[s]}</span>
                  <input type="number" min={0} max={999} value={qty[s]} onChange={e => setQty(v => ({ ...v, [s]: Math.max(0, Number(e.target.value) || 0) }))}
                    className="ml-1 w-14 rounded border border-gray-200 px-1.5 py-0.5 tabular-nums" />
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2 text-sm">
            <button onClick={add} disabled={!SIZES.some(s => qty[s] > 0)} className="rounded-lg bg-purple-600 px-3 py-1.5 font-semibold text-white disabled:opacity-40">Add</button>
            <button onClick={() => setPicked(null)} className="rounded-lg border px-3 py-1.5">Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <ul className="mt-3 grid max-h-72 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
            {(data?.designs ?? []).map(d => (
              <li key={d.id}>
                <button onClick={() => { setPicked(d); setQty({ S: 0, M: 1, L: 0, XL: 0 }); }} className="block w-full text-left" title={d.title}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {d.thumb ? <img src={d.thumb} alt={d.title} className="aspect-[4/5] w-full rounded object-cover hover:ring-2 hover:ring-purple-400" loading="lazy" /> : <span className="block aspect-[4/5] rounded bg-gray-100" />}
                  <span className="mt-0.5 block truncate text-[11px] text-gray-700">{d.title}</span>
                </button>
              </li>
            ))}
          </ul>
          {data && data.total > data.pageSize && (
            <div className="mt-2 flex items-center gap-2 text-xs">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="rounded border px-2 py-1 disabled:opacity-40">Previous</button>
              <span>Page {page + 1} of {Math.ceil(data.total / data.pageSize)}</span>
              <button disabled={(page + 1) * data.pageSize >= data.total} onClick={() => setPage(p => p + 1)} className="rounded border px-2 py-1 disabled:opacity-40">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------- files

interface FileSpec { name: string; url: string; widthMm: number; heightMm: number; quantity: number; size: Size; title: string; finalDpi: number; quality: string }

/** Fetch a print file; Cloudinary answers 423 while an AI upscale is still being made */
async function fetchPrint(url: string, onWait: () => void): Promise<ArrayBuffer> {
  const deadline = Date.now() + 180_000;
  let delay = 3000;
  for (;;) {
    const r = await fetch(url);
    if (r.ok) return r.arrayBuffer();
    if (r.status !== 423 || Date.now() > deadline) throw new Error(`Couldn’t fetch the print file (${r.status})`);
    onWait();
    await new Promise(res => setTimeout(res, delay));
    delay = Math.min(delay * 1.5, 15000);
  }
}

/** One page at the exact finished size with the image filling it */
async function toPdf(jpg: ArrayBuffer, widthMm: number, heightMm: number, title: string): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib');
  const pt = (mm: number) => (mm / 25.4) * 72;
  const doc = await PDFDocument.create();
  doc.setTitle(title); doc.setCreator('Pawtraits');
  const img = await doc.embedJpg(jpg);
  const page = doc.addPage([pt(widthMm), pt(heightMm)]);
  page.drawImage(img, { x: 0, y: 0, width: pt(widthMm), height: pt(heightMm) });
  return doc.save();
}

function orderSheet(ref: string, printer: string, files: FileSpec[], ext: string): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = [['File', 'Size', 'Width (cm)', 'Height (cm)', 'Quantity', 'Material', 'Design', 'Resolution (dpi)'].map(esc).join(',')];
  for (const f of files) rows.push([`${f.name}.${ext}`, f.size, f.widthMm / 10, f.heightMm / 10, f.quantity, 'Foamex', f.title, f.finalDpi].map(esc).join(','));
  const total = files.reduce((n, f) => n + f.quantity, 0);
  rows.push('', [esc(`${ref} for ${printer}: ${files.length} files, ${total} prints`)].join(','));
  return rows.join('\n');
}

function Downloader({ id, disabled, onDone }: { id: string; disabled: boolean; onDone: () => void }) {
  const [format, setFormat] = useState<'pdf' | 'jpg'>('pdf');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canPickFolder = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

  const run = async (mode: 'folder' | 'zip') => {
    setError(null);
    let dir: any = null;
    if (mode === 'folder') {
      try { dir = await (window as any).showDirectoryPicker({ mode: 'readwrite' }); } catch { return; }   // cancelled
    }
    setBusy(true);
    try {
      const d = await api<{ ref: string; printer: string; files: FileSpec[]; problems: string[] }>(`/api/admin/stock/trade-orders/${id}/files`, { method: 'POST', body: '{}' });
      const outDir = dir ? await dir.getDirectoryHandle(d.ref, { create: true }) : null;
      const zip = dir ? null : new (await import('jszip')).default();
      const write = async (name: string, data: Uint8Array | ArrayBuffer | string) => {
        if (outDir) {
          const fh = await outDir.getFileHandle(name, { create: true });
          const w = await fh.createWritable(); await w.write(data); await w.close();
        } else zip!.file(name, data);
      };
      for (let i = 0; i < d.files.length; i++) {
        const f = d.files[i];
        setProgress(`${i + 1} of ${d.files.length}: ${f.title} (${f.size})…`);
        const jpg = await fetchPrint(f.url, () => setProgress(`${i + 1} of ${d.files.length}: ${f.title} (${f.size}), upscaling for print, about a minute…`));
        await write(`${f.name}.${format}`, format === 'pdf' ? await toPdf(jpg, f.widthMm, f.heightMm, `${d.ref} ${f.title} ${f.size}`) : jpg);
      }
      await write('order-sheet.csv', orderSheet(d.ref, d.printer, d.files, format));
      if (zip) {
        setProgress('Making the ZIP…');
        const blob = await zip.generateAsync({ type: 'blob' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = `${d.ref}.zip`; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
      }
      const total = d.files.reduce((n, f) => n + f.quantity, 0);
      setProgress(`Done: ${d.files.length} files (${total} prints) ${dir ? `in the “${d.ref}” folder` : `in ${d.ref}.zip`}, with order-sheet.csv.${d.problems.length ? ` Skipped: ${d.problems.join('; ')}` : ''}`);
      onDone();
    } catch (e: any) {
      setError(e.message || 'Download failed'); setProgress(null);
    }
    setBusy(false);
  };

  return (
    <div className="mt-6 rounded-xl border border-purple-200 bg-purple-50/50 p-4">
      <h2 className="text-sm font-semibold text-gray-900">Print files for the printer</h2>
      <p className="text-xs text-gray-600">One file per line at the exact finished size, 300 dpi, no bleed or crop marks, named with the size and quantity, plus order-sheet.csv. Colours are RGB: the printer converts to CMYK.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1"><input type="radio" checked={format === 'pdf'} onChange={() => setFormat('pdf')} /> PDF (exact page size)</label>
        <label className="flex items-center gap-1"><input type="radio" checked={format === 'jpg'} onChange={() => setFormat('jpg')} /> JPG</label>
        {canPickFolder && (
          <button disabled={busy || disabled} onClick={() => run('folder')} className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 font-semibold text-white hover:bg-purple-700 disabled:opacity-40">
            <FolderDown className="h-4 w-4" /> Save into a folder…
          </button>
        )}
        <button disabled={busy || disabled} onClick={() => run('zip')} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold disabled:opacity-40 ${canPickFolder ? 'border border-purple-300 text-purple-800 hover:bg-purple-50' : 'bg-purple-600 text-white hover:bg-purple-700'}`}>
          <Download className="h-4 w-4" /> Download ZIP
        </button>
        {disabled && <span className="text-xs text-amber-700">Save your changes first</span>}
      </div>
      {progress && <p role="status" className="mt-2 text-sm text-gray-800">{busy && <Loader2 className="mr-1 inline h-4 w-4 animate-spin" />}{progress}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------- labels

/** One label per print (63.5 × 38.1 mm, 21 per A4 sheet, template CL2163), same order as the files */
function Labels({ id, disabled, count }: { id: string; disabled: boolean; count: number }) {
  const [locations, setLocations] = useState<{ code: string; name: string; location_type: string }[]>([]);
  const [loc, setLoc] = useState('');
  const [start, setStart] = useState(1);
  const [guides, setGuides] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { fetch('/api/admin/stock/locations?activeOnly=true', { credentials: 'include' }).then(r => (r.ok ? r.json() : [])).then(d => setLocations(Array.isArray(d) ? d : [])).catch(() => {}); }, []);
  const sheets = Math.ceil((count + start - 1) / 21);

  const download = async () => {
    setBusy(true); setError(null);
    try {
      const r = await fetch(`/api/admin/stock/trade-orders/${id}/labels`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locationCode: loc || undefined, startPosition: start, showGuides: guides }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || `Failed (${r.status})`); }
      const blob = await r.blob();
      const name = /filename="([^"]+)"/.exec(r.headers.get('Content-Disposition') || '')?.[1] || 'labels.pdf';
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
    } catch (e: any) { setError(e.message); }
    setBusy(false);
  };

  return (
    <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50/50 p-4">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900"><Tag className="h-4 w-4 text-purple-600" /> Labels</h2>
      <p className="text-xs text-gray-600">One label per print ({count}, on {sheets} sheet{sheets === 1 ? '' : 's'} of 21), in the same order as the print files: thumbnail, title, size and a QR to buy it or put your own pet in it. Frosted 63.5 × 38.1 mm labels, 21 per A4 (CL2163). Print at 100% / actual size.</p>
      <div className="mt-3 flex flex-wrap items-end gap-3 text-sm">
        <label>QR credits the stall
          <select value={loc} onChange={e => setLoc(e.target.value)} className="mt-0.5 block rounded border border-gray-200 bg-white px-2 py-1">
            <option value="">No stall</option>
            {locations.filter(l => l.location_type === 'stall').map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
        </label>
        <label>Start at label
          <input type="number" min={1} max={21} value={start} onChange={e => setStart(Math.max(1, Math.min(21, Number(e.target.value) || 1)))} className="mt-0.5 block w-16 rounded border border-gray-200 px-2 py-1" />
        </label>
        <label className="flex items-center gap-1 pb-1"><input type="checkbox" checked={guides} onChange={e => setGuides(e.target.checked)} /> Outlines (test print on paper)</label>
        <button onClick={download} disabled={busy || disabled} className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 font-semibold text-white hover:bg-purple-700 disabled:opacity-40">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download labels PDF
        </button>
        {disabled && <span className="text-xs text-amber-700">Save your changes first</span>}
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
