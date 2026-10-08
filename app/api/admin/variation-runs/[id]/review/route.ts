import { NextRequest, NextResponse, after } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { approveItems, rejectItems, retryFailed, tick, describeItem } from '@/lib/variations/batch';
import { autoTagNew } from '@/lib/collections/auto-tag';

export const maxDuration = 120;

/**
 * Review a run: { approve: ids, visibility: 'public' | 'hidden' } | { reject: ids } | { retryFailed: true }
 * | { edit: { id, description } } | { describe: ids } (write descriptions again, up to 10).
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
  if (body.edit?.id && typeof body.edit.description === 'string') {
    const description = body.edit.description.trim().slice(0, 4000);
    const { data, error } = await supabase.from('variation_run_items').update({ description: description || null, description_error: null, updated_at: new Date().toISOString() })
      .eq('id', body.edit.id).eq('run_id', id).eq('status', 'generated').select('id, description');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data?.length) return NextResponse.json({ error: 'Only images waiting for review can be edited' }, { status: 409 });
    return NextResponse.json(data[0]);
  }
  if (Array.isArray(body.describe) && body.describe.length) {
    const { data: items } = await supabase.from('variation_run_items').select('id, preview_thumb_url, preview_url, metadata')
      .eq('run_id', id).eq('status', 'generated').in('id', body.describe.slice(0, 10));
    const out = await Promise.all((items ?? []).map(async (it: any) => ({ id: it.id, description: await describeItem(supabase, it) })));
    return NextResponse.json({ results: out });
  }
  if (Array.isArray(body.reject) && body.reject.length) {
    return NextResponse.json({ rejected: await rejectItems(supabase, id, body.reject.slice(0, 500)) });
  }
  if (Array.isArray(body.approve) && body.approve.length) {
    const results = await approveItems(supabase, id, body.approve.slice(0, 25), body.visibility === 'hidden' ? 'hidden' : 'public');
    const saved = results.filter((r) => r.ok && r.imageId).map((r) => r.imageId!);
    // Descriptions were written before review and saved with each design; now tags and collections
    after(async () => { for (const imageId of saved) await autoTagNew(supabase, imageId); });
    return NextResponse.json({ results });
  }
  return NextResponse.json({ error: 'Nothing to do' }, { status: 400 });
}
