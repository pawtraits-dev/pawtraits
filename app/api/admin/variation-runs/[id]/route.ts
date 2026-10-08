import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { cancelRun } from '@/lib/variations/batch';
import { plainTitle } from '@/lib/variations/combos';

export const dynamic = 'force-dynamic';

const FILTERS: Record<string, string[]> = {
  review: ['generated'],
  waiting: ['queued', 'submitted'],
  approved: ['approved'],
  rejected: ['rejected'],
  failed: ['failed'],
  cancelled: ['cancelled'],
};

/** One run: summary, jobs, cost so far and a page of items (?filter=review&page=0) */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const sp = new URL(request.url).searchParams;
  const filter = FILTERS[sp.get('filter') ?? ''] ? sp.get('filter')! : 'all';
  const page = Math.max(0, Number(sp.get('page')) || 0);
  const size = Math.min(Math.max(Number(sp.get('size')) || 60, 1), 200);
  const supabase = serviceClient();

  const { data: run } = await supabase.from('variation_runs').select('*').eq('id', id).maybeSingle();
  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  let q = supabase.from('variation_run_items')
    .select('id, reference_image_id, variation_key, label, status, preview_url, preview_thumb_url, width, height, saved_image_id, error, updated_at', { count: 'exact' })
    .eq('run_id', id).order('reference_image_id').order('label').range(page * size, page * size + size - 1);
  if (filter !== 'all') q = q.in('status', FILTERS[filter]);
  const [items, counts, jobs, costs, refs] = await Promise.all([
    q,
    supabase.from('variation_run_counts').select('*').eq('run_id', id).maybeSingle(),
    supabase.from('variation_run_jobs').select('id, state, item_count, error, submitted_at, finished_at, processed_at').eq('run_id', id).order('created_at'),
    supabase.from('ai_usage').select('cost_usd, output_images').eq('batch_job_id', id).limit(20000),
    supabase.from('image_catalog').select('id, description, public_url, image_variants').in('id', run.reference_ids ?? []),
  ]);
  const cost = (costs.data ?? []).reduce((s: number, c: any) => s + Number(c.cost_usd ?? 0), 0);
  return NextResponse.json({
    run,
    counts: counts.data,
    jobs: jobs.data ?? [],
    cost_usd: Math.round(cost * 10000) / 10000,
    references: (refs.data ?? []).map((r: any) => ({ id: r.id, title: plainTitle(r.description), thumb: r.image_variants?.thumbnail?.url || r.public_url })),
    items: items.data ?? [],
    total: items.count ?? 0,
    page,
    size,
    filter,
  });
}

/** Cancel: stops Gemini jobs that haven't finished; previews already made stay for review */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  await cancelRun(serviceClient(), id);
  return NextResponse.json({ ok: true });
}
