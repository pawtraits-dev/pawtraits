/**
 * Fulfilment queue for /admin/orders.
 * GET → { orders, counts, defaultProvider, returnAddress }
 */
import { NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { getFulfilmentQueue, FulfilmentError } from '@/lib/fulfillment/order-fulfilment';
import { getSetting } from '@/lib/app-settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const [queue, defaultProvider, returnAddress] = await Promise.all([
      getFulfilmentQueue(serviceClient()),
      getSetting('default_fulfillment_provider'),
      getSetting('return_address'),
    ]);
    return NextResponse.json({ ...queue, defaultProvider, returnAddress });
  } catch (e: any) {
    const status = e instanceof FulfilmentError ? e.status : 500;
    const message = /self_print_status|fulfillment_provider/.test(e?.message || '')
      ? 'Run db/migrations/2026-09-29-self-print-fulfilment.sql in Supabase to turn on the fulfilment queue.'
      : e?.message || 'Failed to load the fulfilment queue';
    return NextResponse.json({ error: message }, { status });
  }
}
