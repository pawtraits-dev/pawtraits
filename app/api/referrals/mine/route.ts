import { NextRequest, NextResponse } from 'next/server';
import { getRequester } from '@/lib/guest/access';
import { serviceClient } from '@/lib/qr/server';
import { getReferralDetails } from '@/lib/referrals/share';
import { isUuid } from '@/lib/referrals/text';

export const dynamic = 'force-dynamic';

/**
 * GET /api/referrals/mine[?orderId=<uuid>]
 * What the "Give 10%, get 10%" card needs: the caller's own referral code, link and first name.
 *  - signed in, no orderId: the signed-in customer's own
 *  - orderId: the buyer of that paid order (the confirmation page is open to guests who hold the order id, as the
 *    order lookup there is). A different signed-in user (partner, admin) gets nothing.
 * { details: null } when there is nothing to show: the card simply does not appear. A missing code is made for
 * a registered customer who has none.
 */
export async function GET(request: NextRequest) {
  const none = NextResponse.json({ details: null }, { headers: { 'Cache-Control': 'no-store' } });
  try {
    const { user } = await getRequester(request);
    const supabase = serviceClient();
    const orderId = new URL(request.url).searchParams.get('orderId');
    let email: string | null = user?.email ?? null;

    if (orderId) {
      if (!isUuid(orderId)) return none;
      const { data: order } = await supabase.from('orders').select('customer_email, payment_status').eq('id', orderId).maybeSingle();
      if (!order?.customer_email || (order.payment_status && order.payment_status !== 'paid')) return none;
      if (user?.email && user.email.toLowerCase() !== order.customer_email.toLowerCase()) return none;
      email = order.customer_email;
    }
    if (!email) return none;

    const d = await getReferralDetails(supabase, email, { create: true });
    if (!d) return none;
    return NextResponse.json({ details: { code: d.code, shareUrl: d.shareUrl, firstName: d.firstName } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.warn('referral share details failed', e);
    return none;
  }
}
