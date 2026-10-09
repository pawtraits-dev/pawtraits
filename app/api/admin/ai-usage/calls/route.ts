import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { periodStart } from '@/lib/ai/period';

export const dynamic = 'force-dynamic';

const SORTS: Record<string, string> = {
  when: 'created_at',
  cost: 'cost_usd',
  time: 'duration_ms',
  input: 'input_tokens',
  thinking: 'thinking_tokens',
  image: 'output_image_tokens',
};
const PAGE_SIZES = [25, 50, 100, 200];

/**
 * GET /api/admin/ai-usage/calls — every AI call in the period, one page at a time.
 *   days, sort (when|cost|time|input|thinking|image), dir (asc|desc),
 *   feature, model, size (1K|2K|4K|none), status (ok|failed), batch (yes|no), page (0-based), per
 * Customer paintings also carry the end-to-end step timings saved on the painting.
 */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const q = new URL(request.url).searchParams;
  const days = Math.min(Math.max(Number(q.get('days')) || 30, 1), 365);
  const from = periodStart(days);
  const sortKey = SORTS[q.get('sort') || 'when'] ? (q.get('sort') || 'when') : 'when';
  const ascending = q.get('dir') === 'asc';
  const per = PAGE_SIZES.includes(Number(q.get('per'))) ? Number(q.get('per')) : 50;
  const page = Math.max(Number(q.get('page')) || 0, 0);

  const supabase = serviceClient();
  let query = supabase
    .from('ai_usage')
    .select('id, created_at, feature, model, is_batch, image_size, input_tokens, cached_input_tokens, thinking_tokens, output_text_tokens, output_image_tokens, output_images, cost_input_usd, cost_thinking_usd, cost_output_usd, cost_usd, success, error, duration_ms, image_id, customer_image_id, batch_job_id', { count: 'exact' })
    .gte('created_at', from.toISOString());

  const feature = q.get('feature');
  if (feature) query = query.eq('feature', feature);
  const model = q.get('model');
  if (model) query = query.eq('model', model);
  const size = q.get('size');
  if (size === 'none') query = query.is('image_size', null);
  else if (size) query = query.eq('image_size', size);
  const status = q.get('status');
  if (status === 'ok') query = query.eq('success', true);
  else if (status === 'failed') query = query.eq('success', false);
  const batch = q.get('batch');
  if (batch === 'yes') query = query.eq('is_batch', true);
  else if (batch === 'no') query = query.eq('is_batch', false);

  query = query.order(SORTS[sortKey], { ascending, nullsFirst: false });
  if (sortKey !== 'when') query = query.order('created_at', { ascending: false });
  const { data, count, error } = await query.range(page * per, page * per + per - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // End-to-end timings for customer paintings (saved by the generate route and the phone)
  const ids = Array.from(new Set((data ?? []).map((r) => r.customer_image_id).filter(Boolean))) as string[];
  const paintings: Record<string, { timings: any; preview: string | null; status: string | null }> = {};
  if (ids.length) {
    const { data: rows } = await supabase
      .from('customer_custom_images')
      .select('id, status, generated_image_url, timings:generation_metadata->timings')
      .in('id', ids);
    for (const r of (rows ?? []) as any[]) paintings[r.id] = { timings: r.timings ?? null, preview: r.generated_image_url ?? null, status: r.status ?? null };
  }

  return NextResponse.json({
    calls: (data ?? []).map((r) => ({ ...r, painting: r.customer_image_id ? paintings[r.customer_image_id] ?? null : null })),
    total: count ?? 0,
    page,
    per,
  });
}
