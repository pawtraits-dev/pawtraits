/**
 * POST /api/phone-cases/composite  { customImageId, group }
 * The customer's finished painting in the design's case art for that camera layout (built once,
 * then cached). Signed-in owner, or the guest device that made it. Returns a watermarked preview.
 */
import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';
import { getRequester, canAccessCustomImage } from '@/lib/guest/access';
import { buildCaseComposite } from '@/lib/phone-cases/composite';
import { previewUrl } from '@/lib/phone-cases/public';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const { customImageId, group } = await req.json().catch(() => ({}));
  if (!UUID.test(customImageId || '') || !/^[A-Z]$/.test(group || '')) return NextResponse.json({ error: 'customImageId and group are required' }, { status: 400 });
  const requester = await getRequester(req);
  const db = serviceClient();
  const { data: custom } = await db.from('customer_custom_images').select('id, customer_email, guest_session_id').eq('id', customImageId).maybeSingle();
  if (!custom || !canAccessCustomImage(custom as any, requester)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const c = await buildCaseComposite(db, customImageId, group);
    return NextResponse.json({ group, url: previewUrl(c.public_id) });
  } catch (e: any) {
    console.error('case composite failed', customImageId, group, e);
    return NextResponse.json({ error: e?.message || 'Could not make the case preview' }, { status: 500 });
  }
}
