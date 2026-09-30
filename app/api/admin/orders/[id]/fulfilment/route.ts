/**
 * Fulfilment actions for one order.
 * POST { action, ... } → updated order (with fulfilment_stage)
 *   mark_printed | mark_packed | mark_posted {service, trackingCode?, trackingUrl?, carrier?, notify?}
 *   undo | use_self_print | send_to_gelato | release | resend_posted_email | rebuild_print_files | save_notes {notes}
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { applyFulfilmentAction, fulfilmentStage, FulfilmentError, type FulfilmentAction } from '@/lib/fulfillment/order-fulfilment';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Gelato order creation / 4K print master re-render can be slow

const ACTIONS = new Set(['mark_printed', 'mark_packed', 'mark_posted', 'undo', 'use_self_print', 'send_to_gelato', 'release', 'resend_posted_email', 'save_notes', 'rebuild_print_files']);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid order id' }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as FulfilmentAction;
  if (!body || !ACTIONS.has((body as any).action)) return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  try {
    const order = await applyFulfilmentAction(serviceClient(), id, body);
    return NextResponse.json({ ...order, fulfilment_stage: fulfilmentStage(order) });
  } catch (e: any) {
    const status = e instanceof FulfilmentError ? e.status : 500;
    console.error(`Fulfilment action ${(body as any).action} failed for ${id}:`, e);
    return NextResponse.json({ error: e?.message || 'Action failed' }, { status });
  }
}
