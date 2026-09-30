'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Check, ExternalLink, FileText, Printer, Send, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { AdminSupabaseService } from '@/lib/admin-supabase';
import { SELF_PRINT_STEPS, STAGE_LABELS, describeOrderItem, fulfilmentStage, itemRef, itemTitle, postedItems } from '@/lib/fulfillment/shared';
import FulfilmentActions from './FulfilmentActions';
import PrintFileLink from './PrintFileLink';
import type { FulfilmentOrder } from '@/lib/product-types';

const adminService = new AdminSupabaseService();

const STEP_TIME: Record<string, keyof FulfilmentOrder> = { to_print: 'created_at', printed: 'printed_at', packed: 'packed_at', posted: 'shipped_at' };

function when(iso?: string | null) {
  return iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
}

/** Fulfilment card for /admin/orders/[id]: choose self-print or Gelato, move through the steps. */
export default function OrderFulfilmentPanel({ order: raw, onChanged }: { order: any; onChanged: () => void }) {
  const { toast } = useToast();
  const order: FulfilmentOrder = { ...raw, fulfilment_stage: fulfilmentStage(raw) };
  const stage = order.fulfilment_stage;
  const [notes, setNotes] = useState(order.fulfillment_notes || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setNotes(raw.fulfillment_notes || ''); }, [raw.fulfillment_notes]);

  if (!stage) return null; // nothing to post

  const items = postedItems(order);
  const isGelato = stage === 'gelato';
  const isSelfPrint = order.fulfillment_provider === 'self_print' && !isGelato;
  const stepIdx = isSelfPrint && order.self_print_status ? SELF_PRINT_STEPS.indexOf(order.self_print_status) : -1;

  const updated = (o: FulfilmentOrder) => {
    toast({ title: `${o.order_number}: ${o.fulfilment_stage ? STAGE_LABELS[o.fulfilment_stage] : 'updated'}` });
    onChanged();
  };
  const fail = (message: string) => toast({ title: 'Couldn’t update the order', description: message, variant: 'destructive' });

  const choose = async (provider: 'self_print' | 'gelato') => {
    if (provider === 'gelato' && !window.confirm(`Send ${order.order_number} to Gelato? They'll print and post it, and you'll be charged by Gelato. This can't be undone from here.`)) return;
    setBusy(true);
    const result = await adminService.updateOrderFulfilment(order.id, { action: provider === 'gelato' ? 'send_to_gelato' : (stage === 'on_hold' ? 'release' : 'use_self_print') });
    setBusy(false);
    if (result.ok) updated(result.data); else fail(result.error);
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    const result = await adminService.updateOrderFulfilment(order.id, { action: 'save_notes', notes });
    setSavingNotes(false);
    if (result.ok) toast({ title: 'Note saved' }); else fail(result.error);
  };

  return (
    <Card className="border-purple-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2"><Printer className="w-5 h-5 text-purple-600" />Fulfilment</CardTitle>
          {!isGelato && stage !== 'on_hold' && stage !== 'needs_routing' && (
            <FulfilmentActions order={order} onUpdated={updated} onError={fail} size="default" />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Provider choice */}
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={busy || isSelfPrint || isGelato || stage === 'posted'}
            onClick={() => choose('self_print')}
            className={`rounded-lg border-2 p-3 text-left transition-colors ${isSelfPrint ? 'border-purple-600 bg-purple-50' : 'border-gray-200 hover:border-purple-300 disabled:hover:border-gray-200'} disabled:cursor-default`}
          >
            <div className="flex items-center justify-between font-medium text-gray-900">
              Self print <span className="text-xs font-normal text-gray-500">(default)</span>
              {isSelfPrint && <Check className="w-4 h-4 text-purple-600" />}
            </div>
            <p className="mt-1 text-xs text-gray-600">Print on the UV printer, pack and post it yourself.</p>
          </button>
          <button
            type="button"
            disabled={busy || isGelato || stage === 'posted'}
            onClick={() => choose('gelato')}
            className={`rounded-lg border-2 p-3 text-left transition-colors ${isGelato ? 'border-purple-600 bg-purple-50' : 'border-gray-200 hover:border-purple-300 disabled:hover:border-gray-200'} disabled:cursor-default`}
          >
            <div className="flex items-center justify-between font-medium text-gray-900">
              Gelato
              {isGelato ? <Check className="w-4 h-4 text-purple-600" /> : busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 text-gray-400" />}
            </div>
            <p className="mt-1 text-xs text-gray-600">{isGelato ? `Order ${order.gelato_order_id} · ${order.gelato_status || 'pending'}` : 'Send the print file to Gelato to print and post.'}</p>
          </button>
        </div>

        {stage === 'on_hold' && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">On hold: {order.error_message || 'check this order before fulfilling'}. Choosing a method releases it.</p>
        )}
        {stage === 'needs_routing' && (
          <p className="rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-800">Not routed yet{order.error_message ? ` — ${order.error_message}` : ''}. Choose how to fulfil it.</p>
        )}

        {/* Self-print steps */}
        {isSelfPrint && (
          <ol className="grid grid-cols-4 gap-2">
            {SELF_PRINT_STEPS.map((s, i) => {
              const done = i <= stepIdx;
              const t = (order as any)[STEP_TIME[s]] as string | null;
              return (
                <li key={s} className="text-center">
                  <div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${done ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {done ? <Check className="w-4 h-4" /> : i + 1}
                  </div>
                  <div className={`mt-1 text-xs font-medium ${i === stepIdx ? 'text-purple-700' : 'text-gray-600'}`}>{STAGE_LABELS[s]}</div>
                  {done && t && <div className="text-[11px] text-gray-500">{when(t)}</div>}
                </li>
              );
            })}
          </ol>
        )}

        {stage === 'posted' && (
          <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-900">
            Posted {when(order.shipped_at)} via {order.carrier || 'post'}
            {order.tracking_code && <> · <a className="underline" href={order.tracking_url || '#'} target="_blank" rel="noopener noreferrer">{order.tracking_code}</a></>}
            {order.shipped_email_sent_at ? ` · customer emailed ${when(order.shipped_email_sent_at)}` : ' · customer not emailed'}
          </div>
        )}

        {/* Print files */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-900">To print</h4>
            <Button variant="outline" size="sm" onClick={() => window.open(adminService.getPackingSlipsUrl([order.id]), '_blank')}>
              <FileText className="w-4 h-4 mr-1.5" />Packing slip
            </Button>
          </div>
          {items.map((item, idx) => (
            <div key={item.id} className="flex items-center gap-3 rounded-lg border border-gray-100 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.image_url || '/placeholder.svg'} alt="" className="h-14 w-14 rounded object-cover bg-gray-100" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 truncate">{item.quantity > 1 && <span className="text-purple-700">{item.quantity}× </span>}{itemTitle(item)}</div>
                <div className="text-xs text-gray-600">{describeOrderItem(item)} · <span className="font-mono">{itemRef(order, idx)}</span></div>
              </div>
              <PrintFileLink item={item} />
            </div>
          ))}
        </div>

        {/* Notes (shown on the packing slip) */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-900">Packing note</h4>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} maxLength={2000} placeholder="e.g. gift — no price inside; reprint top edge" />
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={saveNotes} disabled={savingNotes || notes === (order.fulfillment_notes || '')}>
              {savingNotes && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}Save note
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
