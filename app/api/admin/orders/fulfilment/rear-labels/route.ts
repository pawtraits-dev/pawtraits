/**
 * Rear labels PDF: GET ?ids=<orderId>,<orderId>…&start=<1–21>&guides=1
 * One small label per print we post (A4, 21 per sheet, same sheet as the stall-stock labels), to stick on the
 * back: the Pawtrait, the pet's name when known, and the customer's own referral QR. Read-only: no referral
 * codes are created while printing.
 */
import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { selfPrintItems } from '@/lib/fulfillment/shared';
import { buildRearLabels } from '@/lib/fulfillment/rear-labels';
import { generatePrintLabels } from '@/lib/stock/print-labels';
import { resolveOrderImage } from '@/lib/orders/order-image';
import { referralRates } from '@/lib/app-settings';
import { getReferralDetailsForEmails, siteBaseUrl } from '@/lib/referrals/share';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;
const MAX_LABELS = 630;   // 30 sheets
const UUID = /^[0-9a-f-]{36}$/i;

cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });

async function thumbnail(publicId: string): Promise<Uint8Array | null> {
  try {
    const url = cloudinary.url(publicId, { width: 300, height: 400, crop: 'fill', gravity: 'auto', quality: 85, format: 'jpg' });
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const ids = parseIds(request);
  if (!ids) return NextResponse.json({ error: 'Pass ?ids= with 1–100 order ids' }, { status: 400 });
  const params = new URL(request.url).searchParams;
  const start = Math.min(21, Math.max(1, Math.floor(Number(params.get('start')) || 1)));
  const guides = params.get('guides') === '1';

  const db = serviceClient();
  const { data, error } = await db.from('orders').select('*, order_items (*)').in('id', ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Keep the order the admin selected them in
  const orders = ids.map(id => (data || []).find((o: any) => o.id === id)).filter((o: any) => o && selfPrintItems(o).length > 0);
  if (!orders.length) return NextResponse.json({ error: 'None of those orders have prints to post' }, { status: 400 });

  // The customer's own referral code (read-only: no codes are made while printing)
  const byEmail = await getReferralDetailsForEmails(db, orders.map((o: any) => o.customer_email), { baseUrl: siteBaseUrl() });
  const referrals = new Map<string, { code: string; shareUrl: string }>();
  for (const o of orders as any[]) {
    if (String(o.order_type || '').startsWith('partner')) continue; // a partner's order for a client: not the customer's own parcel
    const d = byEmail.get(String(o.customer_email || '').toLowerCase());
    if (d) referrals.set(o.id, { code: d.code, shareUrl: d.shareUrl });
  }

  // Pet names (custom images only) and picture public ids, one lookup per distinct image
  const items = (orders as any[]).flatMap(o => selfPrintItems(o));
  const imageIds = Array.from(new Set(items.map(i => String(i.image_id || '')).filter(Boolean)));
  const uuidIds = imageIds.filter(i => UUID.test(i));   // order_items.image_id is text; custom image ids are uuids
  const petById = new Map<string, string | null>();
  if (uuidIds.length) {
    const { data: custom } = await db.from('customer_custom_images').select('id, pet_name').in('id', uuidIds);
    for (const c of custom ?? []) petById.set(c.id, c.pet_name ?? null);
  }
  const publicById = new Map<string, string | null>();
  await Promise.all(imageIds.map(async id => {
    try { publicById.set(id, (await resolveOrderImage(db, id))?.cloudinaryPublicId ?? null); } catch { publicById.set(id, null); }
  }));
  const petNames = new Map<string, string | null>();
  const publicIds = new Map<string, string | null>();
  for (const i of items) {
    petNames.set(i.id, petById.get(String(i.image_id)) ?? null);
    publicIds.set(i.id, publicById.get(String(i.image_id)) ?? null);
  }

  const { labels, thumbKeys } = buildRearLabels(orders, referrals, await referralRates(), { petNames, publicIds });
  if (labels.length > MAX_LABELS) return NextResponse.json({ error: `Too many labels (${labels.length}); max ${MAX_LABELS}` }, { status: 400 });

  const thumbnails = new Map<string, Uint8Array>();
  await Promise.all(Array.from(thumbKeys.entries()).map(async ([key, publicId]) => { const b = await thumbnail(publicId); if (b) thumbnails.set(key, b); }));

  const pdf = await generatePrintLabels(labels, { startPosition: start, showGuides: guides, thumbnails });
  const name = orders.length === 1 ? `rear-labels-${(orders[0] as any).order_number}.pdf` : `rear-labels-${new Date().toISOString().slice(0, 10)}-${orders.length}.pdf`;
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${name}"`,
      'Cache-Control': 'no-store',
    },
  });
}

function parseIds(request: NextRequest): string[] | null {
  const ids = (new URL(request.url).searchParams.get('ids') || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!ids.length || ids.length > 100 || ids.some(id => !UUID.test(id))) return null;
  return Array.from(new Set(ids));
}
