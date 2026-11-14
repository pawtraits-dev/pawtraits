/**
 * Packing slips PDF: GET ?ids=<orderId>,<orderId>…
 * One A4 slip per order (address label to cut out + pick list); a print-run summary first when several.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { generatePackingSlips } from '@/lib/fulfillment/packing-slips';
import { needsPosting } from '@/lib/fulfillment/order-fulfilment';
import { getSetting } from '@/lib/app-settings';
import { getReferralDetailsForEmails, siteBaseUrl } from '@/lib/referrals/share';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const ids = parseIds(request);
  if (!ids) return NextResponse.json({ error: 'Pass ?ids= with 1–100 order ids' }, { status: 400 });

  const { data, error } = await serviceClient().from('orders').select('*, order_items (*)').in('id', ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Keep the order the admin selected them in
  const orders = ids.map(id => (data || []).find((o: any) => o.id === id)).filter((o: any) => o && needsPosting(o));
  if (!orders.length) return NextResponse.json({ error: 'None of those orders have prints to post' }, { status: 400 });

  // The customer's own referral QR for the parcel (read-only: no codes are made while printing)
  const db = serviceClient();
  const byEmail = await getReferralDetailsForEmails(db, orders.map((o: any) => o.customer_email), { baseUrl: siteBaseUrl() });
  const referrals = new Map<string, { code: string; shareUrl: string; shortLink: string }>();
  for (const o of orders as any[]) {
    if (String(o.order_type || '').startsWith('partner')) continue; // a partner's order for a client: not the customer's own parcel
    const d = byEmail.get(String(o.customer_email || '').toLowerCase());
    if (d) referrals.set(o.id, { code: d.code, shareUrl: d.shareUrl, shortLink: d.shortLink });
  }

  const bytes = await generatePackingSlips(orders, { returnAddress: await getSetting('return_address'), referrals });
  const name = orders.length === 1 ? `packing-slip-${orders[0].order_number}.pdf` : `packing-slips-${new Date().toISOString().slice(0, 10)}-${orders.length}.pdf`;
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${name}"`,
      'Cache-Control': 'no-store',
    },
  });
}

function parseIds(request: NextRequest): string[] | null {
  const ids = (new URL(request.url).searchParams.get('ids') || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!ids.length || ids.length > 100 || ids.some(id => !/^[0-9a-f-]{36}$/i.test(id))) return null;
  return Array.from(new Set(ids));
}
