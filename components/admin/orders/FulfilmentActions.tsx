'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Loader2, MoreHorizontal, Printer, Package, Send, Undo2, Truck, Mail, FileText, PlayCircle, RefreshCw } from 'lucide-react';
import { AdminSupabaseService } from '@/lib/admin-supabase';
import MarkPostedDialog, { type MarkPostedValues } from './MarkPostedDialog';
import type { FulfilmentActionRequest, FulfilmentOrder } from '@/lib/product-types';

const adminService = new AdminSupabaseService();

interface Props {
  order: FulfilmentOrder;
  onUpdated: (order: FulfilmentOrder) => void;
  onError: (message: string) => void;
  size?: 'sm' | 'default';
  /** Show the secondary actions menu (undo, Gelato, email, packing slip) */
  showMenu?: boolean;
}

/** The next-step button for an order in the fulfilment queue, plus a menu of other actions. */
export default function FulfilmentActions({ order, onUpdated, onError, size = 'sm', showMenu = true }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [postOpen, setPostOpen] = useState(false);
  const stage = order.fulfilment_stage;

  const run = async (request: FulfilmentActionRequest): Promise<string | null> => {
    setBusy(request.action);
    const result = await adminService.updateOrderFulfilment(order.id, request);
    setBusy(null);
    if (!result.ok) { onError(result.error); return result.error; }
    onUpdated(result.data);
    return null;
  };

  const sendToGelato = () => {
    if (!window.confirm(`Send ${order.order_number} to Gelato? They'll print and post it, and you'll be charged by Gelato. This can't be undone from here.`)) return;
    run({ action: 'send_to_gelato' });
  };

  const primary = (() => {
    switch (stage) {
      case 'to_print': return <Button size={size} disabled={!!busy} onClick={() => run({ action: 'mark_printed' })} className="bg-purple-600 hover:bg-purple-700">{busy === 'mark_printed' ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Printer className="w-4 h-4 mr-1.5" />}Printed</Button>;
      case 'printed': return <Button size={size} disabled={!!busy} onClick={() => run({ action: 'mark_packed' })} className="bg-purple-600 hover:bg-purple-700">{busy === 'mark_packed' ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Package className="w-4 h-4 mr-1.5" />}Packed</Button>;
      case 'packed': return <Button size={size} disabled={!!busy} onClick={() => setPostOpen(true)} className="bg-green-600 hover:bg-green-700"><Truck className="w-4 h-4 mr-1.5" />Posted…</Button>;
      case 'on_hold': return <Button size={size} variant="outline" disabled={!!busy} onClick={() => window.confirm(`Release ${order.order_number} from hold and queue it to print? Check the payment first.`) && run({ action: 'release' })}>{busy === 'release' ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-1.5" />}Release to print</Button>;
      case 'needs_routing': return <Button size={size} disabled={!!busy} onClick={() => run({ action: 'use_self_print' })} className="bg-purple-600 hover:bg-purple-700">{busy === 'use_self_print' ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Printer className="w-4 h-4 mr-1.5" />}Self print</Button>;
      default: return null;
    }
  })();

  const canGelato = !order.gelato_order_id && stage !== 'posted' && stage !== 'gelato';
  const canUndo = order.fulfillment_provider === 'self_print' && stage && ['printed', 'packed', 'posted'].includes(stage);

  return (
    <div className="flex items-center gap-1.5">
      {primary}
      {showMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size={size} variant="ghost" aria-label="More actions" disabled={!!busy}>
              {busy && !primary ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreHorizontal className="w-4 h-4" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => window.open(adminService.getPackingSlipsUrl([order.id]), '_blank')}>
              <FileText className="w-4 h-4 mr-2" />Packing slip
            </DropdownMenuItem>
            {(stage === 'to_print' || stage === 'printed') && (
              <DropdownMenuItem onSelect={() => setPostOpen(true)}><Truck className="w-4 h-4 mr-2" />Mark posted…</DropdownMenuItem>
            )}
            {stage === 'posted' && (
              <DropdownMenuItem onSelect={() => run({ action: 'resend_posted_email' })}><Mail className="w-4 h-4 mr-2" />Resend “posted” email</DropdownMenuItem>
            )}
            {!order.gelato_order_id && stage !== 'posted' && (
              <DropdownMenuItem onSelect={() => run({ action: 'rebuild_print_files' })}><RefreshCw className="w-4 h-4 mr-2" />Rebuild print files</DropdownMenuItem>
            )}
            {canUndo && (
              <DropdownMenuItem onSelect={() => run({ action: 'undo' })}><Undo2 className="w-4 h-4 mr-2" />Move back a step</DropdownMenuItem>
            )}
            {canGelato && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={sendToGelato}><Send className="w-4 h-4 mr-2" />Send to Gelato instead</DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <MarkPostedDialog
        open={postOpen}
        orderNumber={order.order_number}
        customerEmail={order.customer_email}
        onOpenChange={setPostOpen}
        onSubmit={(v: MarkPostedValues) => run({ action: 'mark_posted', ...v })}
      />
    </div>
  );
}
