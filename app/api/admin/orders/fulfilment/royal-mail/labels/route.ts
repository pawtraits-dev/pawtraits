/**
 * GET ?ids=<orderId>,… → the Royal Mail labels again (PDF) for orders already sent to Click & Drop
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { getLabels } from '@/lib/shipping/royal-mail/click-and-drop';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const ids = (request.nextUrl.searchParams.get('ids') || '').split(',').filter(id => UUID.test(id)).slice(0, 100);
  const { data, error } = ids.length ? await serviceClient().from('orders').select('id, rm_order_identifier').in('id', ids) : { data: [] as any[], error: null };
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rm = (data ?? []).map((o: any) => Number(o.rm_order_identifier)).filter(n => n > 0);
  if (!rm.length) return NextResponse.json({ error: 'None of these orders have a Royal Mail label yet' }, { status: 400 });
  try {
    const pdf = await getLabels(rm);
    return new NextResponse(Buffer.from(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="royal-mail-labels-${new Date().toISOString().slice(0, 10)}.pdf"`, 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not get the labels' }, { status: e?.status && e.status < 600 ? e.status : 500 });
  }
}
