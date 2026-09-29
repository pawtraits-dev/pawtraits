/**
 * GET /api/orders/{orderId}/download/{itemId}
 *
 * Legacy download endpoint. It used to trust any Authorization header or an ?email= param
 * and served the watermarked image. It now hands off to the entitlement-checked download
 * (/api/downloads/[id]), which requires the signed-in owner and serves the full-quality file.
 */
import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id: orderId, itemId } = await params;
  const supabase = serviceClient();

  const { data: item } = await supabase
    .from('order_items').select('id, image_id').eq('id', itemId).eq('order_id', orderId).maybeSingle();
  if (!item) return NextResponse.json({ error: 'Download not found' }, { status: 404 });

  const { data: ent } = await supabase
    .from('digital_entitlements')
    .select('id')
    .eq('order_id', orderId)
    .or(`custom_image_id.eq.${item.image_id},catalog_image_id.eq.${item.image_id}`)
    .order('source', { ascending: true }) // 'purchase' before 'welcome_gift'
    .limit(1)
    .maybeSingle();
  if (!ent) return NextResponse.json({ error: 'No download available for this item' }, { status: 404 });

  const wantsJson = (request.headers.get('accept') || '').includes('application/json')
    || (request.headers.get('content-type') || '').includes('application/json');
  const target = `/api/downloads/${ent.id}`;
  if (wantsJson) {
    // Existing order page fetches this as JSON and then opens downloadUrl
    return NextResponse.json({ success: true, downloadUrl: target });
  }
  return NextResponse.redirect(new URL(target, request.url), 302);
}
