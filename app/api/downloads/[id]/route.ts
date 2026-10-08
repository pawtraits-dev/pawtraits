/**
 * GET /api/downloads/[id]            → signed-in owner
 * GET /api/downloads/[id]?t=<token>  → signed link from the purchase email (works before activation)
 * Redirects to a 7-day signed, full-quality Cloudinary URL. Locked gifts need account activation.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getRequester } from '@/lib/guest/access';
import { serviceClient } from '@/lib/qr/server';
import { resolveOrderImage, getCustomerDownloadUrl } from '@/lib/orders/order-image';
import { verifyDownload } from '@/lib/orders/entitlements';

export const dynamic = 'force-dynamic';
// A 4K master may be rendered on the first download of a small preview
export const maxDuration = 300;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = serviceClient();
  const { data: ent } = await supabase
    .from('digital_entitlements')
    .select('id, customer_id, email, status, source, custom_image_id, catalog_image_id, order_id, download_count')
    .eq('id', id)
    .maybeSingle();
  if (!ent || ent.status === 'revoked') return NextResponse.json({ error: 'Download not found' }, { status: 404 });

  let allowed = verifyDownload(ent.id, request.nextUrl.searchParams.get('t')) && ent.source === 'purchase';
  if (!allowed) {
    const { user } = await getRequester(request);
    if (user) {
      const { data: profile } = await supabase.from('user_profiles').select('customer_id').eq('user_id', user.id).maybeSingle();
      allowed = (!!profile?.customer_id && profile.customer_id === ent.customer_id)
        || (!!user.email && user.email.toLowerCase() === ent.email.toLowerCase());
    }
  }
  if (!allowed) return NextResponse.json({ error: 'Please sign in to download' }, { status: 401 });
  if (ent.status === 'locked') {
    return NextResponse.json({ error: 'Activate your account from the email we sent to unlock this download' }, { status: 403 });
  }

  let img = await resolveOrderImage(supabase, (ent.custom_image_id || ent.catalog_image_id)!);
  if (!img) return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  // A small (1K/2K) preview with no 4K master yet (normally made when the order was paid):
  // make it now so the download is full resolution
  if (img.kind === 'custom' && !img.printMasterPublicId) {
    const { customPreviewIsSmall, ensurePrintMaster } = await import('@/lib/print/print-master');
    if (await customPreviewIsSmall(supabase, img.id)) {
      const r = await ensurePrintMaster(supabase, img.id);
      if (r.status === 'pending') return NextResponse.json({ error: 'Your full-resolution file is being prepared. Please try again in a minute.' }, { status: 503 });
      img = (await resolveOrderImage(supabase, img.id)) ?? img;
    }
  }
  const url = await getCustomerDownloadUrl(img, ent.customer_id || ent.email, ent.order_id || ent.id);

  await supabase.from('digital_entitlements').update({
    download_count: (ent.download_count ?? 0) + 1, last_downloaded_at: new Date().toISOString(),
  }).eq('id', ent.id);

  return NextResponse.redirect(url, 302);
}
