'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, FileText, Download, Printer, Package, RefreshCw, AlertTriangle, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { AdminSupabaseService } from '@/lib/admin-supabase';
import { STAGE_LABELS, describeOrderItem, itemTitle, itemRef, postedItems } from '@/lib/fulfillment/shared';
import FulfilmentActions from './FulfilmentActions';
import PrintFileLink from './PrintFileLink';
import type { FulfilmentOrder, FulfilmentProvider, FulfilmentStage } from '@/lib/product-types';

const adminService = new AdminSupabaseService();

const TABS: FulfilmentStage[] = ['to_print', 'printed', 'packed', 'posted', 'on_hold', 'needs_routing', 'gelato'];
const TAB_HINT: Partial<Record<FulfilmentStage, string>> = {
  to_print: 'Paid and waiting to be printed — oldest first.',
  printed: 'Printed, waiting to be packed.',
  packed: 'Packed. Buy postage (Click & Drop CSV below), then mark each one posted.',
  posted: 'Posted in the last 14 days.',
  on_hold: 'Held because the amount paid looked wrong. Check the payment in Stripe before releasing.',
  needs_routing: 'Paid before self-print was switched on, or the automatic routing failed. Choose how to fulfil each one.',
  gelato: 'Sent to Gelato in the last 30 days — they print and post these.',
};
const BADGE: Record<FulfilmentStage, string> = {
  to_print: 'bg-amber-100 text-amber-800',
  printed: 'bg-blue-100 text-blue-800',
  packed: 'bg-indigo-100 text-indigo-800',
  posted: 'bg-green-100 text-green-800',
  on_hold: 'bg-red-100 text-red-800',
  needs_routing: 'bg-orange-100 text-orange-800',
  gelato: 'bg-gray-100 text-gray-700',
};

function age(iso: string): string {
  const hours = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (hours < 1) return 'just now';
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function FulfilmentQueue() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<FulfilmentOrder[]>([]);
  const [defaultProvider, setDefaultProvider] = useState<FulfilmentProvider>('self_print');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<FulfilmentStage>('to_print');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await adminService.getFulfilmentQueue();
    setLoading(false);
    if (!result.ok) { setError(result.error); return; }
    setError(null);
    setOrders(result.data.orders);
    setDefaultProvider(result.data.defaultProvider);
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c: Partial<Record<FulfilmentStage, number>> = {};
    for (const o of orders) if (o.fulfilment_stage) c[o.fulfilment_stage] = (c[o.fulfilment_stage] || 0) + 1;
    return c;
  }, [orders]);

  // Open the first tab with work in it
  useEffect(() => {
    if (!orders.length || (counts[tab] || 0) > 0) return;
    const first = (['on_hold', 'needs_routing', 'to_print', 'printed', 'packed'] as FulfilmentStage[]).find(s => counts[s]);
    if (first) setTab(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders.length]);

  const visible = orders
    .filter(o => o.fulfilment_stage === tab)
    .sort((a, b) => tab === 'posted' || tab === 'gelato'
      ? new Date(b.shipped_at || b.created_at).getTime() - new Date(a.shipped_at || a.created_at).getTime()
      : new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const selectedIds = visible.filter(o => selected.has(o.id)).map(o => o.id);
  const allSelected = visible.length > 0 && selectedIds.length === visible.length;

  const replace = (updated: FulfilmentOrder) => {
    setOrders(prev => prev.map(o => (o.id === updated.id ? { ...o, ...updated } : o)));
    setSelected(prev => { const next = new Set(prev); next.delete(updated.id); return next; });
    toast({ title: `${updated.order_number}: ${updated.fulfilment_stage ? STAGE_LABELS[updated.fulfilment_stage] : 'updated'}` });
  };
  const fail = (message: string) => toast({ title: 'Couldn’t update the order', description: message, variant: 'destructive' });

  const changeDefault = async (value: FulfilmentProvider) => {
    const previous = defaultProvider;
    setDefaultProvider(value);
    const result = await adminService.updateAppSetting('default_fulfillment_provider', value);
    if (!result.ok) { setDefaultProvider(previous); fail(result.error); return; }
    toast({ title: value === 'self_print' ? 'New orders will queue here to self-print' : 'New orders will be sent to Gelato automatically' });
  };

  const bulkAdvance = async (action: 'mark_printed' | 'mark_packed') => {
    setBulkBusy(true);
    let done = 0;
    for (const id of selectedIds) {
      const result = await adminService.updateOrderFulfilment(id, { action });
      if (result.ok) { done++; setOrders(prev => prev.map(o => (o.id === id ? { ...o, ...result.data } : o))); }
      else fail(`${orders.find(o => o.id === id)?.order_number}: ${result.error}`);
    }
    setSelected(new Set());
    setBulkBusy(false);
    toast({ title: `${done} order${done === 1 ? '' : 's'} marked ${action === 'mark_printed' ? 'printed' : 'packed'}` });
  };

  const toggle = (id: string) => setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  return (
    <Card className="border-purple-200">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2"><Printer className="w-5 h-5 text-purple-600" />Fulfilment</CardTitle>
            <p className="text-sm text-gray-600 mt-1">Orders with prints to post. Downloads and prints handed over at the stall don’t appear here.</p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <span className="text-sm text-gray-600 whitespace-nowrap">New orders go to</span>
            <Select value={defaultProvider} onValueChange={v => changeDefault(v as FulfilmentProvider)}>
              <SelectTrigger className="flex-1 sm:w-52 sm:flex-none" aria-label="Default fulfilment"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="self_print">Self print (default)</SelectItem>
                <SelectItem value="gelato">Gelato (automatic)</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={load} disabled={loading} aria-label="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error ? (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{error}
          </div>
        ) : (
          <>
            {/* Stage tabs */}
            <div className="flex flex-wrap gap-2" role="tablist">
              {TABS.filter(s => s !== 'on_hold' && s !== 'needs_routing' && s !== 'gelato' || counts[s]).map(s => (
                <button
                  key={s}
                  role="tab"
                  aria-selected={tab === s}
                  onClick={() => { setTab(s); setSelected(new Set()); }}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${tab === s ? 'border-purple-600 bg-purple-600 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-purple-300'}`}
                >
                  {STAGE_LABELS[s]}
                  <span className={`ml-1.5 rounded-full px-1.5 text-xs ${tab === s ? 'bg-white/20' : (s === 'on_hold' || s === 'needs_routing') ? 'bg-red-100 text-red-700' : 'bg-gray-100'}`}>{counts[s] || 0}</span>
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-500">{TAB_HINT[tab]}</p>

            {/* Bulk actions */}
            {visible.length > 0 && tab !== 'gelato' && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
                <label className="flex items-center gap-2 text-sm text-gray-700 mr-2">
                  <input type="checkbox" className="h-4 w-4 accent-purple-600" checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(visible.map(o => o.id)))} />
                  {selectedIds.length ? `${selectedIds.length} selected` : 'Select all'}
                </label>
                <Button size="sm" variant="outline" disabled={!selectedIds.length}
                  onClick={() => window.open(adminService.getPackingSlipsUrl(selectedIds), '_blank')}>
                  <FileText className="w-4 h-4 mr-1.5" />Packing slips
                </Button>
                <Button size="sm" variant="outline" disabled={!selectedIds.length}
                  onClick={() => { window.location.href = adminService.getClickAndDropCsvUrl(selectedIds); }}>
                  <Download className="w-4 h-4 mr-1.5" />Click &amp; Drop CSV
                </Button>
                {tab === 'to_print' && (
                  <Button size="sm" disabled={!selectedIds.length || bulkBusy} onClick={() => bulkAdvance('mark_printed')} className="bg-purple-600 hover:bg-purple-700">
                    {bulkBusy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Printer className="w-4 h-4 mr-1.5" />}Mark printed
                  </Button>
                )}
                {tab === 'printed' && (
                  <Button size="sm" disabled={!selectedIds.length || bulkBusy} onClick={() => bulkAdvance('mark_packed')} className="bg-purple-600 hover:bg-purple-700">
                    {bulkBusy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Package className="w-4 h-4 mr-1.5" />}Mark packed
                  </Button>
                )}
              </div>
            )}

            {/* Orders */}
            {loading && !orders.length ? (
              <div className="py-10 text-center text-gray-500"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />Loading…</div>
            ) : visible.length === 0 ? (
              <div className="py-10 text-center text-gray-500">Nothing {STAGE_LABELS[tab].toLowerCase()} right now.</div>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                {visible.map(order => {
                  const items = postedItems(order);
                  return (
                    <li key={order.id} className="flex flex-col gap-3 p-3 md:flex-row md:items-center">
                      <div className="flex items-start gap-3 md:w-64 md:shrink-0">
                        {tab !== 'gelato' && (
                          <input type="checkbox" className="mt-1 h-4 w-4 accent-purple-600" checked={selected.has(order.id)} onChange={() => toggle(order.id)} aria-label={`Select ${order.order_number}`} />
                        )}
                        <div className="min-w-0">
                          <Link href={`/admin/orders/${order.id}`} className="font-semibold text-gray-900 hover:text-purple-700">{order.order_number}</Link>
                          <div className="text-xs text-gray-500">{age(order.created_at)} · £{(order.total_amount / 100).toFixed(2)}</div>
                          <div className="text-sm text-gray-700 truncate">{order.shipping_first_name} {order.shipping_last_name}</div>
                          <div className="text-xs text-gray-500">{order.shipping_postcode?.toUpperCase()} · {order.shipping_country}</div>
                        </div>
                      </div>

                      <div className="flex-1 space-y-1.5">
                        {items.map((item, idx) => (
                          <div key={item.id} className="flex items-center gap-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={item.image_url || '/placeholder.svg'} alt="" className="h-12 w-12 rounded object-cover bg-gray-100" />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-gray-900 truncate">{item.quantity > 1 && <span className="text-purple-700">{item.quantity}× </span>}{itemTitle(item)}</div>
                              <div className="text-xs text-gray-600">{describeOrderItem(item)} · <span className="font-mono">{itemRef(order, idx)}</span></div>
                            </div>
                            <PrintFileLink item={item} />
                          </div>
                        ))}
                        {order.fulfillment_notes && <p className="text-xs text-amber-800 bg-amber-50 rounded px-2 py-1">Note: {order.fulfillment_notes}</p>}
                        {order.error_message && (tab === 'on_hold' || tab === 'needs_routing') && <p className="text-xs text-red-700">{order.error_message}</p>}
                        {tab === 'posted' && (
                          <p className="text-xs text-gray-600">
                            {order.carrier}{order.tracking_code ? ` · ${order.tracking_code}` : ' · untracked'}
                            {order.shipped_email_sent_at ? ' · customer emailed' : ' · not emailed'}
                          </p>
                        )}
                        {tab === 'gelato' && <p className="text-xs text-gray-600">Gelato {order.gelato_status || 'pending'} · {order.gelato_order_id}</p>}
                      </div>

                      <div className="flex items-center justify-between gap-2 md:justify-end">
                        <Badge className={`${BADGE[order.fulfilment_stage!]} md:hidden`}>{STAGE_LABELS[order.fulfilment_stage!]}</Badge>
                        {tab !== 'gelato' && <FulfilmentActions order={order} onUpdated={replace} onError={fail} />}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
