import { NextRequest, NextResponse, after } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { approveItems, rejectItems, retryFailed, tick } from '@/lib/variations/batch';
import { autoTagNew } from '@/lib/collections/auto-tag';
import { ImageDescriptionGenerator } from '@/lib/image-description-generator';

export const maxDuration = 120;

/**
 * Review a run: { approve: ids, visibility: 'public' | 'hidden' } | { reject: ids } | { retryFailed: true }.
 * Approve at most ~25 per call (the page sends them in groups).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const supabase = serviceClient();

  if (body.retryFailed) {
    const n = await retryFailed(supabase, id);
    if (n) after(() => tick(serviceClient(), 100_000).catch((e) => console.error('tick after retry:', e)));
    return NextResponse.json({ queued: n });
  }
  if (Array.isArray(body.reject) && body.reject.length) {
    return NextResponse.json({ rejected: await rejectItems(supabase, id, body.reject.slice(0, 500)) });
  }
  if (Array.isArray(body.approve) && body.approve.length) {
    const results = await approveItems(supabase, id, body.approve.slice(0, 25), body.visibility === 'hidden' ? 'hidden' : 'public');
    const saved = results.filter((r) => r.ok && r.imageId).map((r) => r.imageId!);
    // Description from the image, then tags and collections
    after(async () => {
      const gen = new ImageDescriptionGenerator();
      for (const imageId of saved) {
        try {
          const { data: img } = await supabase.from('image_catalog').select('image_variants, public_url, breeds(name)').eq('id', imageId).maybeSingle();
          const url = (img as any)?.image_variants?.mid_size?.url || (img as any)?.public_url;
          if (url) {
            const description = await gen.generateDescription(url, (img as any)?.breeds?.name);
            if (description) await supabase.from('image_catalog').update({ description }).eq('id', imageId);
          }
        } catch (e) { console.warn('Description failed for', imageId, e); }
        await autoTagNew(supabase, imageId);
      }
    });
    return NextResponse.json({ results });
  }
  return NextResponse.json({ error: 'Nothing to do' }, { status: 400 });
}
