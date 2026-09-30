/**
 * Royal Mail Click & Drop import file: GET ?ids=<orderId>,…  → CSV download
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { clickAndDropCsv } from '@/lib/fulfillment/packing-slips';
import { needsPosting } from '@/lib/fulfillment/order-fulfilment';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const ids = (new URL(request.url).searchParams.get('ids') || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!ids.length || ids.length > 500 || ids.some(id => !/^[0-9a-f-]{36}$/i.test(id))) {
    return NextResponse.json({ error: 'Pass ?ids= with 1–500 order ids' }, { status: 400 });
  }
  const { data, error } = await serviceClient().from('orders').select('*, order_items (*)').in('id', ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const orders = ids.map(id => (data || []).find((o: any) => o.id === id)).filter((o: any) => o && needsPosting(o));
  if (!orders.length) return NextResponse.json({ error: 'None of those orders have prints to post' }, { status: 400 });

  return new NextResponse(clickAndDropCsv(orders), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="click-and-drop-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
