import { NextRequest, NextResponse } from 'next/server';
import { getRequester } from '@/lib/guest/access';
import { serviceClient } from '@/lib/qr/server';
import { withDownloads } from '@/lib/orders/order-downloads';

export const dynamic = 'force-dynamic';

/**
 * GET /api/shop/orders/[id] — one order, with its items and downloads, for its signed-in owner
 * (customer or the client a partner ordered for), the partner who placed it, or an admin.
 * (?email= is no longer needed or trusted.)
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user } = await getRequester(request);
    if (!user) return NextResponse.json({ error: 'Please sign in to see this order' }, { status: 401 });

    const supabase = serviceClient();
    const [{ data: order }, { data: profile }] = await Promise.all([
      supabase.from('orders').select('*, order_items (*)').eq('id', id).maybeSingle(),
      supabase.from('user_profiles').select('user_type, partner_id').eq('user_id', user.id).maybeSingle(),
    ]);
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const email = (user.email || '').toLowerCase();
    const owns = [order.customer_email, order.client_email].filter(Boolean).some((e: string) => e.toLowerCase() === email)
      || (!!profile?.partner_id && order.placed_by_partner_id === profile.partner_id)
      || profile?.user_type === 'admin';
    // 404 rather than 403, so order ids can't be probed
    if (!owns) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const [withDl] = await withDownloads(supabase, [order]);
    return NextResponse.json(withDl, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error fetching order details:', error);
    return NextResponse.json({ error: 'Failed to fetch order details' }, { status: 500 });
  }
}
